import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_TOOLS } from "./tools";
import { buildSystemPrompt } from "./prompts";
import { projectRunway, projectScenario } from "@/lib/rules-engine/projections";
import { validateActions, formatViolationsForAgent } from "@/lib/rules-engine/validation";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy, ScenarioAction } from "@/lib/rules-engine/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude model selection per PLAN.md §3.4
const OPUS = "claude-opus-4-7-20251101";
const SONNET = "claude-sonnet-4-6";

interface CopilotContext {
  orgId: string;
  snapshot: TreasurySnapshot;
  policy: Policy | null;
  recentSnapshots: TreasurySnapshot[];
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

// Non-streaming chat turn with tool-use loop + guardrails.
// Max 2 reprompts if a proposed action violates policy.
export async function runCopilotTurn(
  ctx: CopilotContext,
  history: CopilotMessage[],
  userMessage: string
): Promise<{ reply: string; toolCalls: { name: string; input: unknown; result: unknown }[] }> {
  const systemPrompt = buildSystemPrompt(ctx.policy, ctx.recentSnapshots);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const toolCalls: { name: string; input: unknown; result: unknown }[] = [];
  let reprompts = 0;

  while (true) {
    const response = await anthropic.messages.create({
      model: isHeavyTool(messages) ? OPUS : SONNET,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: systemPrompt,
          // Anthropic prompt caching: cache the system block (policy + snapshots)
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: COPILOT_TOOLS,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("\n");
      return { reply: text, toolCalls };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      ) as Anthropic.ToolUseBlock[];

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(toolUse.name, toolUse.input, ctx);

        // Guardrail: if propose_allocation returned actions, validate them
        if (toolUse.name === "propose_allocation" && ctx.policy && isProposalResult(result)) {
          const actions = result.actions as ScenarioAction[];
          const validation = validateActions(ctx.snapshot, ctx.policy, actions);
          if (!validation.ok && reprompts < 2) {
            reprompts++;
            const violations = formatViolationsForAgent(validation.blockers);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `POLICY VIOLATION — proposta rejeitada pelo rules-engine:\n${violations}\n\nGere uma proposta alternativa que respeite as restrições.`,
              is_error: true,
            });
            toolCalls.push({ name: toolUse.name, input: toolUse.input, result: "REJECTED" });
            continue;
          }
        }

        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
        toolCalls.push({ name: toolUse.name, input: toolUse.input, result });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return { reply: "Erro interno no copilot.", toolCalls };
}

// Streaming version for real-time chat UI
export async function* streamCopilotTurn(
  ctx: CopilotContext,
  history: CopilotMessage[],
  userMessage: string
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(ctx.policy, ctx.recentSnapshots);
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const stream = anthropic.messages.stream({
    model: SONNET,
    max_tokens: 2048,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: COPILOT_TOOLS,
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeToolCall(
  name: string,
  input: unknown,
  ctx: CopilotContext
): Promise<unknown> {
  switch (name) {
    case "analyze_treasury": {
      const policy = ctx.policy ?? buildFallbackPolicy(ctx.orgId);
      const projection = projectRunway(ctx.snapshot, policy);
      return {
        totalUsd: ctx.snapshot.totalUsd,
        liquidUsd: ctx.snapshot.liquidUsd,
        deployedUsd: projection.deployedCapitalUsd,
        deployedPct: projection.deployedPct,
        liquidRunwayMonths: projection.liquidRunwayMonths,
        protectedRunwayMonths: projection.protectedRunwayMonths,
        blendedAprPct: projection.blendedAprPct,
        estimatedYieldYearUsd: projection.estimatedYieldYearUsd,
        topConcentrationPct: projection.topConcentrationPct,
        topConcentrationProtocol: projection.topConcentrationProtocol,
        complianceScore: projection.complianceScore,
        violations: projection.violations,
        upcomingObligations30dUsd: projection.upcomingObligations30dUsd,
        positions: ctx.snapshot.positions,
      };
    }

    case "explain_policy": {
      const policy = ctx.policy;
      if (!policy) return { error: "Nenhuma política ativa." };
      return {
        preset: policy.preset,
        version: policy.version,
        rules: policy.rules.filter((r) => r.enabled).map((r) => ({
          id: r.id,
          params: r.params,
        })),
      };
    }

    case "propose_allocation": {
      const inp = input as { excess_amount_usd: number; risk_preference?: string };
      const excess = inp.excess_amount_usd;
      const risk = inp.risk_preference ?? "balanced";

      // Simple allocation logic: 70% to lowest-risk adapter, 30% to second
      const adapters =
        risk === "conservative"
          ? [{ id: "kamino-usdc-devnet", pct: 100 }]
          : [{ id: "kamino-usdc-devnet", pct: 70 }, { id: "mock-rwa-usdy", pct: 30 }];

      const actions: ScenarioAction[] = adapters.map((a) => ({
        kind: "deposit" as const,
        adapterId: a.id,
        amountUsd: Math.floor(excess * (a.pct / 100)),
      }));

      return {
        actions,
        rationale: `Aloca $${excess.toLocaleString()} mantendo política ${risk}. Kamino (T1) recebe maior parcela por ser de menor risco.`,
      };
    }

    case "simulate_scenario": {
      const inp = input as { actions: { kind: string; adapter_id: string; amount_usd: number }[] };
      const actions: ScenarioAction[] = inp.actions.map((a) => ({
        kind: a.kind as ScenarioAction["kind"],
        adapterId: a.adapter_id,
        amountUsd: a.amount_usd,
      }));

      const policy = ctx.policy ?? buildFallbackPolicy(ctx.orgId);
      const baseline = projectRunway(ctx.snapshot, policy);
      const scenario = projectScenario(ctx.snapshot, policy, actions);

      return {
        baseline: {
          liquidRunwayMonths: baseline.liquidRunwayMonths,
          blendedAprPct: baseline.blendedAprPct,
          estimatedYieldYearUsd: baseline.estimatedYieldYearUsd,
          topConcentrationPct: baseline.topConcentrationPct,
          complianceScore: baseline.complianceScore,
        },
        scenario: {
          liquidRunwayMonths: scenario.liquidRunwayMonths,
          blendedAprPct: scenario.blendedAprPct,
          estimatedYieldYearUsd: scenario.estimatedYieldYearUsd,
          topConcentrationPct: scenario.topConcentrationPct,
          complianceScore: scenario.complianceScore,
        },
        diff: {
          liquidRunwayMonths: scenario.liquidRunwayMonths - baseline.liquidRunwayMonths,
          blendedAprPct: scenario.blendedAprPct - baseline.blendedAprPct,
          estimatedYieldYearUsd: scenario.estimatedYieldYearUsd - baseline.estimatedYieldYearUsd,
          complianceScore: scenario.complianceScore - baseline.complianceScore,
        },
        violations: scenario.violations,
      };
    }

    case "draft_policy_from_description": {
      const inp = input as { description: string };
      // This tool uses Opus 4.7 for higher quality policy drafting
      const response = await anthropic.messages.create({
        model: OPUS,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Gere um JSON de política de tesouraria a partir da seguinte descrição:\n\n"${inp.description}"\n\nRetorne APENAS o JSON válido, sem markdown ou texto extra. O JSON deve ter os campos: preset (conservative|balanced|aggressive|custom), rules (array com os 7 tipos de regra possíveis).`,
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("");

      try {
        const parsed = JSON.parse(text);
        return { policy: parsed, status: "draft" };
      } catch {
        return { error: "Não foi possível gerar um JSON válido. Tente descrever a política de forma mais específica." };
      }
    }

    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

function buildFallbackPolicy(orgId: string): import("@/lib/rules-engine/types").Policy {
  return {
    ...POLICY_PRESETS.balanced,
    id: "fallback",
    version: 1,
    orgId,
    status: "active",
    preset: "balanced",
    activatedAt: new Date().toISOString(),
  };
}

function isHeavyTool(messages: Anthropic.MessageParam[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return false;
  const content = typeof last.content === "string" ? last.content : "";
  return content.includes("draft_policy") || content.includes("propose_allocation");
}

function isProposalResult(result: unknown): result is { actions: unknown[] } {
  return typeof result === "object" && result !== null && "actions" in result && Array.isArray((result as { actions: unknown }).actions);
}
