"use client";

import { useState, useTransition } from "react";

type IntentStatus =
  | "draft" | "proposed" | "approved" | "queued"
  | "signing" | "broadcast" | "confirmed" | "rejected" | "failed" | "expired";

interface Intent {
  id: string;
  kind: string;
  status: IntentStatus;
  paramsJson: Record<string, unknown>;
  createdAt: Date | string;
}

interface ExecutionDrawerProps {
  intents: Intent[];
  onApprove: (intentId: string) => Promise<void>;
  onExecute: (intentId: string) => Promise<void>;
  onReject: (intentId: string) => Promise<void>;
}

const STATUS_LABEL: Record<IntentStatus, string> = {
  draft:     "rascunho",
  proposed:  "proposto",
  approved:  "aprovado",
  queued:    "na fila",
  signing:   "assinando",
  broadcast: "enviando",
  confirmed: "confirmado",
  rejected:  "rejeitado",
  failed:    "falhou",
  expired:   "expirado",
};

const STATUS_CLASS: Record<IntentStatus, string> = {
  draft:     "text-fg-3 border-line",
  proposed:  "text-blue-400 border-blue-400/30 bg-blue-400/5",
  approved:  "text-accent border-accent/30 bg-accent/5",
  queued:    "text-warn border-warn/30 bg-warn/5",
  signing:   "text-warn border-warn/30 bg-warn/5",
  broadcast: "text-warn border-warn/30 bg-warn/5",
  confirmed: "text-accent border-accent/30 bg-accent/5",
  rejected:  "text-neg border-neg/30 bg-neg/5",
  failed:    "text-neg border-neg/30 bg-neg/5",
  expired:   "text-fg-3 border-line",
};

const KIND_LABEL: Record<string, string> = {
  deposit:   "Depositar",
  withdraw:  "Sacar",
  rebalance: "Rebalancear",
};

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Pulsing animation for in-progress states
function PulsingDot({ color = "bg-warn" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

function IntentRow({
  intent,
  onApprove,
  onExecute,
  onReject,
}: {
  intent: Intent;
  onApprove: () => void;
  onExecute: () => void;
  onReject: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const params = intent.paramsJson as { adapterId?: string; amountUsd?: number };
  const isInProgress = ["signing", "broadcast"].includes(intent.status);

  async function run(action: () => void, key: string) {
    setLoading(key);
    try { await action(); } finally { setLoading(null); }
  }

  return (
    <div className="px-4 py-4 flex items-start gap-4">
      {/* Status pulse for in-progress */}
      <div className="mt-1 shrink-0">
        {isInProgress
          ? <PulsingDot />
          : <span className={`inline-block h-2 w-2 rounded-full ${intent.status === "confirmed" ? "bg-accent" : intent.status === "rejected" || intent.status === "failed" ? "bg-neg" : "bg-fg-3"}`} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-fg">
            {KIND_LABEL[intent.kind] ?? intent.kind}
          </span>
          {params.amountUsd != null && (
            <span className="text-sm font-mono text-fg-2">{fmtUSD(params.amountUsd)}</span>
          )}
          {params.adapterId && (
            <span className="text-xs text-fg-3 font-mono">{params.adapterId}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-mono ${STATUS_CLASS[intent.status]}`}
          >
            {STATUS_LABEL[intent.status]}
          </span>
          <span className="text-xs text-fg-3 font-mono">
            {new Date(intent.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
            })}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {(intent.status === "draft" || intent.status === "proposed") && (
          <>
            <button
              onClick={() => run(onApprove, "approve")}
              disabled={loading !== null}
              className="text-xs px-2.5 py-1 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40 transition-all"
            >
              {loading === "approve" ? "…" : "Aprovar"}
            </button>
            <button
              onClick={() => run(onReject, "reject")}
              disabled={loading !== null}
              className="text-xs px-2.5 py-1 rounded-lg border border-line text-fg-3 hover:border-neg/40 hover:text-neg disabled:opacity-40 transition-all"
            >
              {loading === "reject" ? "…" : "Rejeitar"}
            </button>
          </>
        )}
        {intent.status === "approved" && (
          <button
            onClick={() => run(onExecute, "execute")}
            disabled={loading !== null}
            className="text-xs px-2.5 py-1 rounded-lg bg-accent text-bg-0 hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {loading === "execute" ? "Executando…" : "Executar simulado →"}
          </button>
        )}
      </div>
    </div>
  );
}

export function ExecutionDrawer({
  intents,
  onApprove,
  onExecute,
  onReject,
}: ExecutionDrawerProps) {
  const pending = intents.filter(
    (i) => !["confirmed", "rejected", "failed", "expired"].includes(i.status)
  );
  const done = intents.filter(
    (i) => ["confirmed", "rejected", "failed", "expired"].includes(i.status)
  );

  return (
    <div className="space-y-6">
      {/* Active intents */}
      <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
          Intents ativos — {pending.length}
        </div>
        {pending.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-fg-3 font-mono">
            Nenhum intent pendente. Use o Simulador para criar recomendações.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {pending.map((intent) => (
              <IntentRow
                key={intent.id}
                intent={intent}
                onApprove={() => onApprove(intent.id)}
                onExecute={() => onExecute(intent.id)}
                onReject={() => onReject(intent.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {done.length > 0 && (
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Histórico
          </div>
          <div className="divide-y divide-line">
            {done.slice(0, 10).map((intent) => (
              <IntentRow
                key={intent.id}
                intent={intent}
                onApprove={() => onApprove(intent.id)}
                onExecute={() => onExecute(intent.id)}
                onReject={() => onReject(intent.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
