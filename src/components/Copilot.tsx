"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { approveProposal } from "@/app/(app)/copilot/actions";
import type { StreamEvent, ProposalAction, ProjectionMeta } from "@/lib/agent/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolInfo {
  name: string;
  id: string;
  displayModel: string;
  input?: unknown;
  output?: unknown;
  rejected?: boolean;
}

interface ProposalData {
  actions: ProposalAction[];
  totalUsd: number;
  rationale: string;
  baseline: ProjectionMeta;
  scenario: ProjectionMeta;
}

interface AssistantMsg {
  role: "assistant";
  tools: ToolInfo[];
  text: string;
  proposal?: ProposalData;
}

interface UserMsg {
  role: "user";
  content: string;
}

type Message = UserMsg | AssistantMsg;

// ── Constants ─────────────────────────────────────────────────────────────────

const TOOL_DISPLAY: Record<string, { label: string; note: string }> = {
  analyze_treasury:              { label: "ANALYZE_TREASURY()",            note: "Cached" },
  draft_policy_from_description: { label: "DRAFT_POLICY_FROM_TEXT()",     note: "" },
  explain_policy:                { label: "EXPLAIN_POLICY()",              note: "" },
  propose_allocation:            { label: "PROPOSE_ALLOCATION()",          note: "w/ guardrails" },
  simulate_scenario:             { label: "SIMULATE_SCENARIO()",           note: "pure fn" },
};

const MODEL_LABEL: Record<string, string> = {
  sonnet: "Sonnet 4.6",
  opus:   "Opus 4.7",
};

const SUGGESTIONS = [
  "Analisar tesouraria e identificar excedente ocioso",
  "Quero 4 meses protegidos, sem mais de 30% num protocolo",
  "Simular alocação de 250k em Kamino + 70k em RWA",
  "Resumir últimos 7 dias para o board",
];

const GUARDRAILS = [
  "rules-engine.validateAction antes de qualquer intent",
  "Reprompt automático se ação violar policy (max 2)",
  "Rate limit 10 calls/min · audit log append-only",
  "Toda ação assinada via Phantom no device",
];

const ALL_TOOLS = Object.keys(TOOL_DISPLAY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolChip({ tool, isLast }: { tool: ToolInfo; isLast: boolean }) {
  const meta = TOOL_DISPLAY[tool.name];
  const modelLabel = MODEL_LABEL[tool.displayModel] ?? tool.displayModel;

  return (
    <span className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="text-accent">•</span>
      <span className="text-fg-2 font-semibold">{meta?.label ?? tool.name.toUpperCase()}</span>
      <span className="text-fg-3">·</span>
      <span className="text-fg-3">{modelLabel}</span>
      {meta?.note && <><span className="text-fg-3">·</span><span className="text-fg-3">{meta.note}</span></>}
      {tool.rejected && <span className="text-neg border border-neg/30 bg-neg/5 px-1 rounded">REJECTED</span>}
      {!tool.rejected && tool.output !== undefined && (
        <span className="text-accent border border-accent/30 bg-accent/5 px-1 rounded">OK</span>
      )}
      {!isLast && <span className="text-fg-3 mx-1">›</span>}
    </span>
  );
}

function CodeBlock({ tool }: { tool: ToolInfo }) {
  const [open, setOpen] = useState(true);
  const meta = TOOL_DISPLAY[tool.name];
  const shortId = tool.id.slice(-8).toUpperCase();

  const shouldShow = ["draft_policy_from_description", "simulate_scenario"].includes(tool.name) && tool.input !== undefined;
  if (!shouldShow) return null;

  const inputStr = JSON.stringify(tool.input, null, 2);
  let outputStr = "—";
  if (tool.output !== null && tool.output !== undefined) {
    const out = tool.output as Record<string, unknown>;
    if (tool.name === "draft_policy_from_description" && out.summary) {
      outputStr = JSON.stringify(out.summary, null, 2);
    } else if (tool.name === "simulate_scenario" && out.diff) {
      outputStr = JSON.stringify(out.diff, null, 2);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-bg-0 overflow-hidden text-[11px] font-mono">
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-line cursor-pointer hover:bg-bg-2 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-fg-2">{meta?.label?.toLowerCase().replace("()", "")}(...)</span>
        <div className="flex items-center gap-3">
          <span className="text-fg-3">tool_use_id {shortId}</span>
          <span className="text-fg-3">{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="p-3 space-y-2">
          <div>
            <div className="text-fg-3 mb-1">{"// input"}</div>
            <pre className="text-fg-2 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-32 overflow-y-auto">
              {inputStr}
            </pre>
          </div>
          <div>
            <div className="text-fg-3 mb-1">{"// output (validated)"}</div>
            <pre className="text-fg-2 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-32 overflow-y-auto">
              {outputStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalCard({ data, onApprove }: { data: ProposalData; onApprove: (actions: ProposalAction[]) => void }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleApprove = () => {
    setState("loading");
    setError(null);
    startTransition(async () => {
      const result = await approveProposal(
        data.actions.map((a) => ({ kind: a.kind, adapterId: a.adapterId, amountUsd: a.amountUsd })),
        data.rationale
      );
      if (result.ok) {
        setState("done");
        onApprove(data.actions);
      } else {
        setState("idle");
        setError(result.error ?? "Erro ao aprovar");
      }
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-bg-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">⊙ Recomendação</span>
          <span className="text-[9px] font-mono text-fg-2 font-semibold">· {fmtUSD(data.totalUsd)} USDC</span>
        </div>
        {state === "done" && (
          <a href="/execution" className="text-[9px] font-mono text-accent hover:underline">
            Ver em Execução →
          </a>
        )}
      </div>

      {/* Actions list */}
      <div className="divide-y divide-line">
        {data.actions.map((action, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-[9px] font-mono text-fg-3 mt-0.5 shrink-0">#{i + 1}</span>
              <div>
                <div className="text-xs font-medium text-fg">
                  {action.kind === "deposit" ? "Depositar" : action.kind === "withdraw" ? "Sacar" : "Rebalancear"}{" "}
                  {fmtUSD(action.amountUsd)} {action.adapterId.includes("usdy") || action.adapterId.includes("rwa") ? `(${action.protocol.split(" ")[0]})` : `em ${action.protocol.split(" ")[0]}`}
                </div>
                <div className="text-[10px] text-fg-3 font-mono mt-0.5">
                  {action.strategy} · APR {action.aprPct.toFixed(2)}% · risk tier {action.riskTier}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-accent shrink-0 border border-accent/30 bg-accent/5 px-2 py-0.5 rounded">
              +{fmtUSD(action.monthlyYield)}/mo
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-line flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-mono text-fg-3">
          Compliance score projetado: {data.baseline.complianceScore} → {data.scenario.complianceScore}
          {" · "}runway protegido: {data.baseline.protectedRunwayMonths.toFixed(1)} → {data.scenario.protectedRunwayMonths.toFixed(1)} meses
        </div>
        {error && <span className="text-[10px] text-neg">{error}</span>}
        {state !== "done" ? (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/simulator"
              className="px-3 py-1.5 rounded-lg border border-line text-[10px] font-mono text-fg-3 hover:text-fg hover:border-accent/40 transition-colors"
            >
              Editar
            </a>
            <button
              onClick={handleApprove}
              disabled={state === "loading"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg-0 text-[10px] font-mono font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {state === "loading" ? "Aprovando…" : "✓ Aprovar e simular"}
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-accent">✓ Aprovado — intents criados</span>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  streaming,
  streamTools,
  streamText,
  streamProposal,
}: {
  msg?: AssistantMsg;
  streaming?: boolean;
  streamTools?: ToolInfo[];
  streamText?: string;
  streamProposal?: ProposalData | null;
}) {
  const tools = msg?.tools ?? streamTools ?? [];
  const text = msg?.text ?? streamText ?? "";
  const proposal = msg?.proposal ?? streamProposal ?? null;
  const primaryTool = tools[0];

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-mono text-accent font-bold">
        AI
      </div>
      <div className="flex-1 min-w-0">
        {/* Tool chips header */}
        {tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {tools.map((tool, i) => (
              <ToolChip key={tool.id} tool={tool} isLast={i === tools.length - 1} />
            ))}
          </div>
        )}

        {/* Code blocks for qualifying tools */}
        {tools.filter((t) => t.output !== undefined).map((tool) => (
          <CodeBlock key={tool.id} tool={tool} />
        ))}

        {/* Text response */}
        {text && (
          <div className="text-sm text-fg-2 whitespace-pre-wrap leading-relaxed mt-1">
            {text}
            {streaming && !proposal && (
              <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-pulse" />
            )}
          </div>
        )}
        {!text && streaming && tools.length > 0 && !proposal && (
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-mono text-fg-3">processando…</span>
          </div>
        )}

        {/* Proposal card */}
        {proposal && (
          <ProposalCard
            data={proposal}
            onApprove={() => {}}
          />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface CopilotProps {
  hasSnapshot: boolean;
  policyVersion?: number;
  snapshotCount?: number;
  orgName?: string;
}

export function Copilot({ hasSnapshot, policyVersion, snapshotCount, orgName }: CopilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live streaming state
  const [liveTools, setLiveTools] = useState<ToolInfo[]>([]);
  const [liveText, setLiveText] = useState("");
  const [liveProposal, setLiveProposal] = useState<ProposalData | null>(null);

  // Tool usage tracking for sidebar status
  const [calledTools, setCalledTools] = useState<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<{ tools: ToolInfo[]; text: string; proposal: ProposalData | null }>({ tools: [], text: "", proposal: null });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveText, liveProposal]);

  // Build API-compatible history from messages
  function buildHistory() {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.role === "user" ? msg.content : (msg as AssistantMsg).text,
    }));
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setInput("");
      setError(null);
      const userMsg: UserMsg = { role: "user", content: trimmed };
      setMessages((h) => [...h, userMsg]);
      setIsStreaming(true);
      liveRef.current = { tools: [], text: "", proposal: null };
      setLiveTools([]);
      setLiveText("");
      setLiveProposal(null);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({ message: trimmed, history: buildHistory() }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });

          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              const event = JSON.parse(trimmedLine) as StreamEvent;
              handleStreamEvent(event);
            } catch { /* skip malformed */ }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setError("Falha ao comunicar com o Copilot.");
        }
      } finally {
        // Package completed message
        const completed: AssistantMsg = {
          role: "assistant",
          tools: liveRef.current.tools,
          text: liveRef.current.text,
          proposal: liveRef.current.proposal ?? undefined,
        };
        setMessages((h) => [...h, completed]);
        setLiveTools([]);
        setLiveText("");
        setLiveProposal(null);
        setIsStreaming(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, messages]
  );

  function handleStreamEvent(event: StreamEvent) {
    switch (event.t) {
      case "text":
        liveRef.current.text += event.d;
        setLiveText(liveRef.current.text);
        break;

      case "tool_start":
        liveRef.current.tools = [
          ...liveRef.current.tools,
          { name: event.name, id: event.id, displayModel: event.displayModel },
        ];
        setLiveTools([...liveRef.current.tools]);
        setCalledTools((s) => new Set([...s, event.name]));
        break;

      case "tool_end":
        liveRef.current.tools = liveRef.current.tools.map((t) =>
          t.id === event.id ? { ...t, input: event.input, output: event.output, rejected: event.rejected } : t
        );
        setLiveTools([...liveRef.current.tools]);
        break;

      case "proposal":
        liveRef.current.proposal = {
          actions: event.actions,
          totalUsd: event.totalUsd,
          rationale: event.rationale,
          baseline: event.baseline,
          scenario: event.scenario,
        };
        setLiveProposal(liveRef.current.proposal);
        break;

      case "done":
        break;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: chat ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Context bar */}
        <div className="px-4 py-2 border-b border-line flex items-center justify-between shrink-0">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">WORKSPACE / AI COPILOT</div>
          <div className="flex items-center gap-2">
            {(policyVersion || snapshotCount) && (
              <span className="text-[9px] font-mono text-fg-3 border border-line bg-bg-2 rounded px-2 py-0.5">
                cached:{policyVersion ? ` policy_v${policyVersion}` : ""}{snapshotCount ? ` + ${snapshotCount} snapshot${snapshotCount > 1 ? "s" : ""}` : ""}
              </span>
            )}
            <button
              onClick={() => {
                setMessages([]);
                setLiveTools([]);
                setLiveText("");
                setLiveProposal(null);
                setCalledTools(new Set());
              }}
              className="text-[9px] font-mono text-fg-3 hover:text-fg border border-line rounded px-2 py-0.5 hover:border-accent/40 transition-colors"
            >
              ↺ Nova thread
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="text-xl mb-2 text-accent">✦</div>
              <div className="text-sm font-semibold text-fg mb-1">TreasuryOS Copilot</div>
              <div className="text-xs text-fg-3 mb-6 max-w-xs">
                Pergunte sobre alocação, política, runway, ou peça uma proposta de investimento.
              </div>
              {!hasSnapshot && (
                <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2 text-xs text-warn mb-6 max-w-xs">
                  Nenhum snapshot — tire um snapshot no dashboard para análises precisas.
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-xs lg:max-w-md bg-accent/10 border border-accent/20 text-fg text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ) : (
              <AssistantBubble key={i} msg={msg as AssistantMsg} />
            )
          )}

          {isStreaming && (
            <AssistantBubble
              streaming
              streamTools={liveTools}
              streamText={liveText}
              streamProposal={liveProposal}
            />
          )}

          {error && <div className="text-xs text-neg text-center">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-line px-4 py-3 shrink-0">
          <div className="relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo, descreva uma policy, ou peça uma simulação…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-line bg-bg-2 px-4 py-3 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 disabled:opacity-50 transition-colors min-h-11 max-h-36 overflow-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-9 h-9 rounded-xl border border-neg/40 text-neg hover:bg-neg/10 flex items-center justify-center transition-colors"
              >
                <span className="text-xs">■</span>
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-accent text-bg-0 hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all"
              >
                <span className="text-sm">↑</span>
              </button>
            )}
          </div>
          <div className="text-[9px] text-fg-3 mt-1.5 font-mono">⌘+Enter para enviar</div>
        </div>
      </div>

      {/* ── Right: sidebar ── */}
      <div className="w-68 border-l border-line flex flex-col shrink-0 overflow-y-auto">
        {/* Tools disponíveis */}
        <div className="px-4 py-3 border-b border-line">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>⚙ Tools disponíveis</span>
            <span className="text-fg-3">{ALL_TOOLS.length}</span>
          </div>
          <div className="space-y-2">
            {ALL_TOOLS.map((toolName) => {
              const meta = TOOL_DISPLAY[toolName];
              const displayModel = toolName === "propose_allocation" || toolName === "draft_policy_from_description" ? "Opus 4.7" : "Sonnet 4.6";
              const wasCalled = calledTools.has(toolName);
              return (
                <div key={toolName} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono ${wasCalled ? "text-fg" : "text-fg-2"}`}>
                      {meta.label}
                    </div>
                    <div className="text-[9px] font-mono text-fg-3 mt-0.5">
                      {displayModel}{meta.note ? ` · ${meta.note}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border mt-0.5 ${
                    wasCalled
                      ? "text-accent border-accent/30 bg-accent/5"
                      : "text-fg-3 border-line"
                  }`}>
                    {wasCalled ? "OK" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sugestões */}
        <div className="px-4 py-3 border-b border-line">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-wider mb-2.5">Sugestões</div>
          <div className="space-y-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={isStreaming}
                className="w-full text-left text-[11px] text-fg-3 hover:text-fg flex items-start gap-2 py-1 transition-colors disabled:opacity-50"
              >
                <span className="text-accent shrink-0 mt-px">→</span>
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guardrails */}
        <div className="px-4 py-3">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-wider mb-2.5">◎ Guardrails</div>
          <div className="space-y-1.5">
            {GUARDRAILS.map((g) => (
              <div key={g} className="flex items-start gap-2 text-[10px] text-fg-3">
                <span className="text-accent shrink-0 mt-px">✓</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Org context */}
        {orgName && (
          <div className="px-4 py-3 border-t border-line mt-auto">
            <div className="text-[9px] font-mono text-fg-3">{orgName}</div>
            {policyVersion && (
              <div className="text-[9px] font-mono text-fg-3">policy v{policyVersion} · {snapshotCount ?? 0} snapshots</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
