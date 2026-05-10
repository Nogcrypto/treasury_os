import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_TOOLS } from "./tools";
import { buildSystemPrompt } from "./prompts";
import { projectRunway, projectScenario } from "@/lib/rules-engine/projections";
import { validateActions, formatViolationsForAgent } from "@/lib/rules-engine/validation";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy, ScenarioAction } from "@/lib/rules-engine/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OPUS   = "claude-opus-4-7-20251101";
const SONNET = "claude-sonnet-4-6";

// Display model per tool (cosmetic — actual model selection is below)
const TOOL_DISPLAY_MODEL: Record<string, string> = {
  analyze_treasury:               "sonnet",
  explain_policy:                 "sonnet",
  simulate_scenario:              "sonnet",
  propose_allocation:             "opus",
  draft_policy_from_description:  "opus",
};

const ADAPTER_META: Record<string, { protocol: string; strategy: string; aprPct: number; riskTier: number }> = {
  "kamino-usdc-devnet": { protocol: "Kamino Finance",   strategy: "Lending",        aprPct: 5.84, riskTier: 1 },
  "mock-rwa-usdy":      { protocol: "Ondo Finance",     strategy: "T-Bills",        aprPct: 4.82, riskTier: 2 },
  "sol-liquid-staking": { protocol: "Marinade Finance", strategy: "Liquid Staking", aprPct: 7.20, riskTier: 3 },
};

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

// ── NDJSON event types (one JSON object per line in the stream) ───────────────

export type StreamEvent =
  | { t: "text"; d: string }
  | { t: "tool_start"; name: string; id: string; displayModel: string }
  | { t: "tool_end"; name: string; id: string; input: unknown; output: unknown; rejected?: boolean }
  | { t: "proposal"; actions: ProposalAction[]; totalUsd: number; rationale: string; baseline: ProjectionMeta; scenario: ProjectionMeta }
  | { t: "done" };

export interface ProposalAction {
  kind: string;
  adapterId: string;
  amountUsd: number;
  protocol: string;
  strategy: string;
  aprPct: number;
  riskTier: number;
  monthlyYield: number;
}

export interface ProjectionMeta {
  complianceScore: number;
  protectedRunwayMonths: number;
}

// ── Streaming turn with NDJSON events ────────────────────────────────────────

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

  let reprompts = 0;

  while (true) {
    const stream = anthropic.messages.stream({
      model: SONNET,
      max_tokens: 2048,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: COPILOT_TOOLS,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield ndjson({ t: "text", d: event.delta.text });
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use") {
      yield ndjson({ t: "done" });
      break;
    }

    const toolUseBlocks = final.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const displayModel = TOOL_DISPLAY_MODEL[toolUse.name] ?? "sonnet";
      yield ndjson({ t: "tool_start", name: toolUse.name, id: toolUse.id, displayModel });

      const result = await executeToolCall(toolUse.name, toolUse.input, ctx);

      // Guardrail check for propose_allocation
      if (toolUse.name === "propose_allocation" && ctx.policy && isProposalResult(result) && reprompts < 2) {
        const actions = (result.actions ?? []) as ScenarioAction[];
        const validation = validateActions(ctx.snapshot, ctx.policy, actions);
        if (!validation.ok) {
          reprompts++;
          const violations = formatViolationsForAgent(validation.blockers);
          yield ndjson({ t: "tool_end", name: toolUse.name, id: toolUse.id, input: toolUse.input, output: null, rejected: true });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `POLICY VIOLATION — proposta rejeitada:\n${violations}\n\nGere uma proposta alternativa.`,
            is_error: true,
          });
          continue;
        }

        // Emit proposal event
        const proposal = buildProposalEvent(result as { actions: ScenarioAction[]; rationale: string }, ctx);
        yield ndjson({ t: "tool_end", name: toolUse.name, id: toolUse.id, input: toolUse.input, output: result });
        if (proposal) yield ndjson({ t: "proposal", ...proposal });
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
        continue;
      }

      yield ndjson({ t: "tool_end", name: toolUse.name, id: toolUse.id, input: toolUse.input, output: result });
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }

    messages.push({ role: "assistant", content: final.content });
    messages.push({ role: "user", content: toolResults });
  }
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeToolCall(name: string, input: unknown, ctx: CopilotContext): Promise<unknown> {
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
      if (!ctx.policy) return { error: "Nenhuma política ativa." };
      return {
        preset: ctx.policy.preset,
        version: ctx.policy.version,
        rules: ctx.policy.rules.filter((r) => r.enabled).map((r) => ({ id: r.id, params: r.params })),
      };
    }

    case "propose_allocation": {
      const inp = input as { excess_amount_usd: number; risk_preference?: string };
      const excess = inp.excess_amount_usd;
      const risk = inp.risk_preference ?? "balanced";

      const adapters =
        risk === "conservative"
          ? [{ id: "kamino-usdc-devnet", pct: 100 }]
          : [{ id: "kamino-usdc-devnet", pct: 70 }, { id: "mock-rwa-usdy", pct: 30 }];

      const actions: ScenarioAction[] = adapters.map((a) => ({
        kind: "deposit" as const,
        adapterId: a.id,
        amountUsd: Math.floor(excess * (a.pct / 100)),
        meta: ADAPTER_META[a.id] ? {
          protocol: ADAPTER_META[a.id].protocol,
          aprPct: ADAPTER_META[a.id].aprPct,
          riskTier: ADAPTER_META[a.id].riskTier as 1 | 2 | 3,
        } : undefined,
      }));

      return {
        actions,
        rationale: `Aloca $${excess.toLocaleString()} mantendo política ${risk}. Kamino (T1) recebe maior parcela por ser de menor risco.`,
      };
    }

    case "simulate_scenario": {
      const inp = input as { actions: { kind: string; adapter_id: string; amount_usd: number }[] };
      const actions: ScenarioAction[] = inp.actions.map((a) => {
        const meta = ADAPTER_META[a.adapter_id];
        return {
          kind: a.kind as ScenarioAction["kind"],
          adapterId: a.adapter_id,
          amountUsd: a.amount_usd,
          meta: meta ? { ...meta, riskTier: meta.riskTier as 1 | 2 | 3 } : undefined,
        };
      });

      const policy = ctx.policy ?? buildFallbackPolicy(ctx.orgId);
      const baseline = projectRunway(ctx.snapshot, policy);
      const scenario = projectScenario(ctx.snapshot, policy, actions);

      return {
        baseline: {
          liquidRunwayMonths: +baseline.liquidRunwayMonths.toFixed(1),
          blendedAprPct: +baseline.blendedAprPct.toFixed(2),
          estimatedYieldYearUsd: Math.round(baseline.estimatedYieldYearUsd),
          topConcentrationPct: +baseline.topConcentrationPct.toFixed(1),
          complianceScore: Math.round(baseline.complianceScore),
        },
        scenario: {
          liquidRunwayMonths: +scenario.liquidRunwayMonths.toFixed(1),
          blendedAprPct: +scenario.blendedAprPct.toFixed(2),
          estimatedYieldYearUsd: Math.round(scenario.estimatedYieldYearUsd),
          topConcentrationPct: +scenario.topConcentrationPct.toFixed(1),
          complianceScore: Math.round(scenario.complianceScore),
        },
        diff: {
          liquidRunwayMonths: +(scenario.liquidRunwayMonths - baseline.liquidRunwayMonths).toFixed(1),
          blendedAprPct: +(scenario.blendedAprPct - baseline.blendedAprPct).toFixed(2),
          estimatedYieldYearUsd: Math.round(scenario.estimatedYieldYearUsd - baseline.estimatedYieldYearUsd),
          complianceScore: Math.round(scenario.complianceScore - baseline.complianceScore),
        },
        violations: scenario.violations,
      };
    }

    case "draft_policy_from_description": {
      const inp = input as { description: string };
      const response = await anthropic.messages.create({
        model: OPUS,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Gere um JSON de política de tesouraria a partir da seguinte descrição:\n\n"${inp.description}"\n\nRetorne APENAS o JSON válido, sem markdown ou texto extra. O JSON deve ter: preset (conservative|balanced|aggressive|custom), rules (array com os 7 tipos de regra possíveis com campos id, enabled, params).`,
        }],
      });

      const text = response.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");

      try {
        const parsed = JSON.parse(text);
        // Extract readable summary for display
        const rules = parsed.rules as Array<{ id: string; enabled: boolean; params: Record<string, unknown> }>;
        const summary: Record<string, unknown> = {};
        for (const r of rules) {
          if (!r.enabled) continue;
          if (r.id === "MIN_RUNWAY_DAYS") summary["MIN_RUNWAY_DAYS"] = r.params.days;
          if (r.id === "MAX_CONCENTRATION_PCT") summary["MAX_CONCENTRATION_PCT"] = r.params.pct;
          if (r.id === "MIN_LIQUID_PCT") summary["MIN_LIQUID_PCT"] = r.params.pct;
          if (r.id === "YIELD_ONLY_EXCESS") summary["YIELD_ONLY_EXCESS"] = true;
          if (r.id === "ALLOCATION_WHITELIST") summary["ALLOCATION_WHITELIST"] = r.params.adapters;
        }
        return { policy: parsed, summary, status: "draft" };
      } catch {
        return { error: "Não foi possível gerar um JSON válido." };
      }
    }

    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ndjson(event: StreamEvent): string {
  return JSON.stringify(event) + "\n";
}

function buildProposalEvent(
  result: { actions: ScenarioAction[]; rationale: string },
  ctx: CopilotContext
): Omit<Extract<StreamEvent, { t: "proposal" }>, "t"> | null {
  if (!result.actions?.length) return null;

  const enriched: ProposalAction[] = result.actions.map((a) => {
    const meta = ADAPTER_META[a.adapterId] ?? { protocol: a.adapterId, strategy: "DeFi", aprPct: 0, riskTier: 1 };
    return {
      kind: a.kind,
      adapterId: a.adapterId,
      amountUsd: a.amountUsd,
      protocol: meta.protocol,
      strategy: meta.strategy,
      aprPct: meta.aprPct,
      riskTier: meta.riskTier,
      monthlyYield: Math.round(a.amountUsd * (meta.aprPct / 100) / 12),
    };
  });

  const totalUsd = result.actions.filter((a) => a.kind === "deposit").reduce((s, a) => s + a.amountUsd, 0);

  const policy = ctx.policy ?? buildFallbackPolicy(ctx.orgId);
  const baseline = projectRunway(ctx.snapshot, policy);
  const scenario = projectScenario(ctx.snapshot, policy, result.actions);

  return {
    actions: enriched,
    totalUsd,
    rationale: result.rationale,
    baseline: { complianceScore: Math.round(baseline.complianceScore), protectedRunwayMonths: +baseline.protectedRunwayMonths.toFixed(1) },
    scenario: { complianceScore: Math.round(scenario.complianceScore), protectedRunwayMonths: +scenario.protectedRunwayMonths.toFixed(1) },
  };
}

function buildFallbackPolicy(orgId: string): Policy {
  return { ...POLICY_PRESETS.balanced, id: "fallback", version: 1, orgId, status: "active", activatedAt: new Date().toISOString() };
}

function isProposalResult(result: unknown): result is { actions: unknown[] } {
  return typeof result === "object" && result !== null && "actions" in result && Array.isArray((result as { actions: unknown }).actions);
}
