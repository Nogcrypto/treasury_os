"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { applyScenarioActions, projectRunway, estimateMonthlyBurnUsd } from "@/lib/rules-engine/projections";
import type { TreasurySnapshot, Policy, ScenarioAction } from "@/lib/rules-engine/types";

export type IntentStatus =
  | "draft" | "proposed" | "approved" | "queued"
  | "signing" | "broadcast" | "confirmed" | "rejected" | "failed" | "expired";

export interface IntentRow {
  id: string;
  kind: string;
  status: IntentStatus;
  paramsJson: unknown;
  idempotencyKey: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  txSignature?: string | null;
  onchainAt?: Date | string | null;
}

interface ExecutionDrawerProps {
  intents: IntentRow[];
  walletAddress?: string;
  snapshot: TreasurySnapshot | null;
  policy: Policy | null;
  onApprove: (intentId: string) => Promise<void>;
  onExecute:  (intentId: string) => Promise<void>;
  onReject:   (intentId: string) => Promise<void>;
  onCreate:   (data: { kind: string; adapterId: string; amountUsd: number }) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function shortId(id: string) { return id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase(); }
function shortTx(tx: string)  { return `${tx.slice(0, 5)}…${tx.slice(-4)}`; }

function fmtTime(d: Date | string | null | undefined, locale: string): string {
  if (!d) return "—";
  const fmtLocale = locale === "en" ? "en-US" : "pt-BR";
  return new Date(d).toLocaleTimeString(fmtLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtRelative(d: Date | string, nowLabel: string, yesterdayLabel: string, locale: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return nowLabel;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? yesterdayLabel : `${h}h`;
  const fmtLocale = locale === "en" ? "en-US" : "pt-BR";
  return new Date(d).toLocaleDateString(fmtLocale, { day: "2-digit", month: "short" });
}

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  deposit:   { label: "DEPOSIT",   cls: "bg-accent/10 text-accent border-accent/25" },
  withdraw:  { label: "WITHDRAW",  cls: "bg-neg/10 text-neg border-neg/25" },
  rebalance: { label: "REBALANCE", cls: "bg-warn/10 text-warn border-warn/25" },
};

// ── State machine timeline ─────────────────────────────────────────────────────

const STATE_MACHINE: IntentStatus[] = [
  "draft", "proposed", "approved", "queued", "signing", "broadcast", "confirmed",
];

function stateIndex(status: IntentStatus) {
  if (status === "rejected" || status === "failed" || status === "expired") return -1;
  return STATE_MACHINE.indexOf(status);
}

function deriveTimestamps(intent: IntentRow) {
  const created = new Date(intent.createdAt).getTime();
  const updated = new Date(intent.updatedAt).getTime();
  const idx = stateIndex(intent.status as IntentStatus);
  const spread = Math.max(0, updated - created);
  return STATE_MACHINE.map((_, i) => {
    if (i === 0) return new Date(created);
    if (i === 1) return new Date(created);
    if (i >= idx && idx >= 0) return new Date(updated - (idx - i) * 2_000);
    return new Date(created + Math.round((spread / Math.max(idx, 1)) * i));
  });
}

// ── Rules validation ──────────────────────────────────────────────────────────

type CheckItem = { rule: string; pass: boolean; detail: string };

function computeRulesValidation(
  intent: IntentRow,
  snapshot: TreasurySnapshot | null | undefined,
  policy: Policy | null | undefined,
): CheckItem[] {
  if (!snapshot || !policy) return [];

  const params = intent.paramsJson as { adapterId?: string; amountUsd?: number };
  const adapterId = params.adapterId ?? "";
  const amountUsd = params.amountUsd ?? 0;
  const isKamino = adapterId.includes("kamino");

  const actionKind: ScenarioAction["kind"] =
    intent.kind === "withdraw" ? "withdraw" : "deposit";

  const action: ScenarioAction = {
    kind: actionKind,
    adapterId,
    amountUsd,
    meta: {
      protocol: isKamino ? "Kamino" : "Mock RWA",
      aprPct:   isKamino ? 5.84 : 4.82,
      riskTier: isKamino ? 1 : 2,
      unlockDays: isKamino ? 0 : 1,
    },
  };

  const { liquidUsd, positions } = applyScenarioActions(snapshot, [action]);
  const simSnap: TreasurySnapshot = { ...snapshot, liquidUsd, positions };
  const projection = projectRunway(simSnap, policy);
  const violationMap = new Map(projection.violations.map((v) => [v.ruleId, v]));
  const monthlyBurn = estimateMonthlyBurnUsd(simSnap);

  return policy.rules
    .filter((r) => r.enabled)
    .map((r): CheckItem => {
      const v = violationMap.get(r.id);
      if (v) return { rule: r.id, pass: false, detail: v.message };

      switch (r.id) {
        case "MIN_RUNWAY_DAYS": {
          const minDays = (r.params.days as number) ?? 120;
          const protectedUsd = simSnap.buckets
            .filter((b) => ["emergency", "operating", "payroll", "tax"].includes(b.kind))
            .reduce((s, b) => s + b.balanceUsd, 0);
          const months = monthlyBurn > 0 ? protectedUsd / monthlyBurn : 999;
          return { rule: r.id, pass: true, detail: `runway ${months.toFixed(1)} mo ≥ ${(minDays / 30).toFixed(1)} mo ✓` };
        }
        case "MAX_CONCENTRATION_PCT": {
          const maxPct = (r.params.pct as number) ?? 45;
          return { rule: r.id, pass: true, detail: `${projection.topConcentrationPct.toFixed(1)}% < ${maxPct}% ✓` };
        }
        case "MIN_LIQUID_PCT": {
          const minPct = (r.params.pct as number) ?? 50;
          const liquidPct = simSnap.totalUsd > 0 ? (simSnap.liquidUsd / simSnap.totalUsd) * 100 : 100;
          return { rule: r.id, pass: true, detail: `liquid ${liquidPct.toFixed(1)}% ≥ ${minPct}% ✓` };
        }
        case "ALLOCATION_WHITELIST":
          return { rule: r.id, pass: true, detail: `${adapterId} ⊂ whitelist ✓` };
        case "YIELD_ONLY_EXCESS":
          return { rule: r.id, pass: true, detail: "excess ≥ emergency reserve ✓" };
        case "BUCKET_TARGET":
          return { rule: r.id, pass: true, detail: "buckets within target ✓" };
        case "REBALANCE_TRIGGER":
          return { rule: r.id, pass: true, detail: "bucket deviation < threshold ✓" };
        default:
          return { rule: r.id, pass: true, detail: "✓" };
      }
    });
}

// ── Create intent modal ───────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: ExecutionDrawerProps["onCreate"] }) {
  const t = useTranslations("execution");
  const [kind, setKind] = useState<"deposit" | "withdraw" | "rebalance">("deposit");
  const [adapterId, setAdapterId] = useState("kamino-usdc-devnet");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!amount || parseFloat(amount) <= 0) { setError(t("modal.error_amount" as never)); return; }
    setLoading(true);
    try {
      await onCreate({ kind, adapterId, amountUsd: parseFloat(amount) });
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? t("modal.error_create" as never));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-line rounded-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-5">
          <h3 className="text-sm font-semibold text-fg">{t("modal.title" as never)}</h3>
          <button onClick={onClose} className="text-fg-3 hover:text-fg text-xs">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-fg-3 block mb-1.5">{t("modal.type_label" as never)}</label>
            <div className="flex gap-2">
              {(["deposit", "withdraw", "rebalance"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition-colors ${kind === k ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-fg-3 hover:bg-bg-2"}`}>
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-fg-3 block mb-1.5">{t("modal.protocol_label" as never)}</label>
            <select value={adapterId} onChange={(e) => setAdapterId(e.target.value)}
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60">
              <option value="kamino-usdc-devnet">Kamino Finance (USDC)</option>
              <option value="mock-rwa-usdy">Mock RWA — USDY (Ondo)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-fg-3 block mb-1.5">{t("modal.amount_label" as never)}</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>

          {error && <p className="text-xs text-neg">{error}</p>}

          <button onClick={handleCreate} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-xs font-semibold disabled:opacity-40">
            {loading ? t("modal.creating" as never) : t("modal.create_btn" as never)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Right detail panel ────────────────────────────────────────────────────────

function IntentPanel({
  intent,
  walletAddress,
  snapshot,
  policy,
  onApprove,
  onExecute,
  onReject,
  onClose,
}: {
  intent: IntentRow;
  walletAddress?: string;
  snapshot: TreasurySnapshot | null;
  policy: Policy | null;
  onApprove: () => Promise<void>;
  onExecute: () => Promise<void>;
  onReject: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("execution");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [loading, setLoading] = useState<string | null>(null);
  const params = intent.paramsJson as { adapterId?: string; amountUsd?: number };
  const isTerminal = ["confirmed", "rejected", "failed", "expired"].includes(intent.status);
  const canApprove = ["draft", "proposed"].includes(intent.status);
  const canExecute = intent.status === "approved";
  const timestamps = deriveTimestamps(intent);
  const currentIdx = stateIndex(intent.status as IntentStatus);
  const isRejected = ["rejected", "failed", "expired"].includes(intent.status);
  const checks = computeRulesValidation(intent, snapshot, policy);
  const passCount = checks.filter((c) => c.pass).length;

  const stateLabels: Record<string, string> = {
    draft:     t("state_labels.draft" as never),
    proposed:  t("state_labels.proposed" as never),
    approved:  t("state_labels.approved" as never),
    queued:    t("state_labels.queued" as never),
    signing:   t("state_labels.signing" as never),
    broadcast: t("state_labels.broadcast" as never),
    confirmed: t("state_labels.confirmed" as never),
    rejected:  t("state_labels.rejected" as never),
    failed:    t("state_labels.failed" as never),
  };

  function displayStatus(i: IntentRow): { label: string; cls: string } {
    if (i.status === "confirmed" && i.kind === "deposit") {
      return { label: t("panel.status_active" as never), cls: "text-accent border-accent/40 bg-accent/10" };
    }
    if (i.status === "confirmed") {
      return { label: t("panel.status_closed" as never), cls: "text-fg-3 border-line bg-bg-2" };
    }
    if (["rejected", "failed", "expired"].includes(i.status)) {
      return { label: i.status.toUpperCase(), cls: "text-neg border-neg/30 bg-neg/5" };
    }
    if (["signing", "broadcast", "queued"].includes(i.status)) {
      return { label: i.status.toUpperCase(), cls: "text-warn border-warn/30 bg-warn/5" };
    }
    return { label: i.status.toUpperCase(), cls: "text-fg-2 border-line" };
  }

  const verbLabel =
    intent.kind === "deposit" ? t("panel.title_deposit" as never) :
    intent.kind === "withdraw" ? t("panel.title_withdraw" as never) :
    t("panel.title_rebalance" as never);

  const protocolLabel =
    params.adapterId?.includes("kamino") ? `${t("panel.title_in" as never)} Kamino` :
    params.adapterId?.includes("rwa")    ? `${t("panel.title_in" as never)} RWA` : "";

  const title = `${verbLabel} ${params.amountUsd ? fmtUSD(params.amountUsd) : ""} ${protocolLabel}`.trim();
  const statusDisplay = displayStatus(intent);

  const nowLabel = tCommon("now");
  const yesterdayLabel = tCommon("yesterday");

  async function run(action: () => Promise<void>, key: string) {
    setLoading(key);
    try { await action(); } finally { setLoading(null); }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-line shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">
            INTENT · {shortId(intent.id)} · {intent.idempotencyKey.slice(0, 12).toUpperCase()}
          </div>
          <button onClick={onClose} className="text-fg-3 hover:text-fg text-sm leading-none ml-2 shrink-0">✕</button>
        </div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg leading-tight">{title}</h2>
          <span className={`shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${statusDisplay.cls}`}>
            {statusDisplay.label}
          </span>
        </div>
        <div className="text-[10px] font-mono text-fg-3 mt-1">
          {t("panel.current_state" as never)} · <span className={statusDisplay.cls.includes("accent") ? "text-accent" : "text-fg-2"}>{intent.status.toUpperCase()}</span>
        </div>
      </div>

      {/* State machine timeline */}
      <div className="px-5 py-4 border-b border-line shrink-0">
        <div className="space-y-2">
          {isRejected ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-neg flex items-center justify-center shrink-0">
                <span className="text-neg text-[10px]">✕</span>
              </div>
              <span className="text-xs text-neg font-mono">{stateLabels[intent.status]}</span>
              <span className="text-[10px] font-mono text-fg-3 ml-auto">{fmtTime(intent.updatedAt, locale)}</span>
            </div>
          ) : STATE_MACHINE.map((state, i) => {
            const done = currentIdx >= 0 && i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={state} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  done ? "border-accent bg-accent" : "border-line bg-bg-2"
                }`}>
                  {done && <span className="text-bg-0 text-[10px] font-bold">✓</span>}
                  {!done && isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />}
                </div>
                <span className={`text-xs font-mono ${done ? "text-fg" : "text-fg-3"} ${isCurrent ? "font-semibold" : ""}`}>
                  {stateLabels[state]}
                </span>
                {done && (
                  <span className="text-[10px] font-mono text-fg-3 ml-auto">{fmtTime(timestamps[i], locale)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Details section */}
      <div className="px-5 py-4 border-b border-line shrink-0">
        <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-3">
          {t("panel.details_label" as never)}
        </div>
        <div className="space-y-1.5 text-[11px] font-mono">
          {[
            ["ADAPTER",         params.adapterId ?? "—"],
            ["WALLET",          walletAddress ?? "—"],
            ["RECENT BLOCKHASH", intent.txSignature ? `${intent.txSignature.slice(0, 4)}…${intent.txSignature.slice(-4)}` : "—"],
            ["COMPUTE BUDGET",  "200,000 cu"],
            ["PRIORITY FEE",    "0.000005 SOL"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-fg-3 shrink-0">{k}</span>
              <span className="text-fg-2 text-right truncate max-w-45">{v}</span>
            </div>
          ))}
          {intent.txSignature && (
            <div className="flex justify-between gap-2 mt-1">
              <span className="text-fg-3 shrink-0">TX SIGNATURE</span>
              <button
                onClick={() => navigator.clipboard.writeText(intent.txSignature!)}
                className="text-accent font-mono text-[10px] bg-accent/10 border border-accent/25 px-2 py-0.5 rounded hover:bg-accent/20 transition-colors truncate max-w-40"
                title={intent.txSignature}
              >
                {shortTx(intent.txSignature)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rules validation */}
      <div className="px-5 py-4 border-b border-line shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">
            {t("panel.validation_label" as never)}
          </div>
          {checks.length > 0 && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${passCount === checks.length ? "text-accent border-accent/25 bg-accent/5" : "text-neg border-neg/25 bg-neg/5"}`}>
              {passCount}/{checks.length} OK
            </span>
          )}
        </div>
        {checks.length === 0 ? (
          <p className="text-[11px] text-fg-3 font-mono">
            {!snapshot
              ? t("panel.no_snapshot" as never)
              : t("panel.no_policy" as never)}
          </p>
        ) : (
          <div className="space-y-1.5">
            {checks.map((c) => (
              <div key={c.rule} className="flex items-start gap-2 text-[11px]">
                <span className={`shrink-0 mt-px ${c.pass ? "text-accent" : "text-neg"}`}>{c.pass ? "✓" : "✕"}</span>
                <span className="font-mono text-fg-3 shrink-0">{c.rule}</span>
                <span className="text-fg-3 ml-1 min-w-0 wrap-break-word">· {c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 flex gap-3 shrink-0 mt-auto">
        {!isTerminal && (
          <button
            onClick={() => run(onReject, "reject")}
            disabled={loading !== null}
            className="flex-1 py-2 rounded-lg border border-line text-xs text-fg-3 hover:border-neg/40 hover:text-neg disabled:opacity-40 transition-all"
          >
            {loading === "reject" ? t("panel.rejecting" as never) : t("panel.reject" as never)}
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => run(onApprove, "approve")}
            disabled={loading !== null}
            className="flex-1 py-2 rounded-lg border border-accent/40 text-xs text-accent hover:bg-accent/10 disabled:opacity-40 transition-all"
          >
            {loading === "approve" ? t("panel.approving" as never) : t("panel.approve" as never)}
          </button>
        )}
        {canExecute && (
          <button
            onClick={() => run(onExecute, "execute")}
            disabled={loading !== null}
            className="flex-1 py-2.5 rounded-lg bg-accent text-bg-0 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {loading === "execute" ? t("panel.executing" as never) : t("panel.execute" as never)}
          </button>
        )}
        {isTerminal && (
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-accent text-bg-0 text-xs font-semibold hover:opacity-90 transition-all">
            {t("panel.done" as never)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function ExecutionDrawer({
  intents,
  walletAddress,
  snapshot,
  policy,
  onApprove,
  onExecute,
  onReject,
  onCreate,
}: ExecutionDrawerProps) {
  const t = useTranslations("execution");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [selected, setSelected] = useState<IntentRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const confirmed = intents.filter((i) => i.status === "confirmed").length;
  const simulated = intents.filter((i) => i.txSignature?.startsWith("SIM")).length;

  const nowLabel = tCommon("now");
  const yesterdayLabel = tCommon("yesterday");

  const tableHeaders = [
    t("table_headers.id" as never),
    t("table_headers.type" as never),
    t("table_headers.adapter" as never),
    t("table_headers.value" as never),
    t("table_headers.state" as never),
    t("table_headers.tx" as never),
    t("table_headers.confirmed" as never),
  ];

  function displayStatus(intent: IntentRow): { label: string; cls: string } {
    if (intent.status === "confirmed" && intent.kind === "deposit") {
      return { label: "ACTIVE", cls: "text-accent border-accent/40 bg-accent/10" };
    }
    if (intent.status === "confirmed") {
      return { label: "CLOSED", cls: "text-fg-3 border-line bg-bg-2" };
    }
    if (["rejected", "failed", "expired"].includes(intent.status)) {
      return { label: intent.status.toUpperCase(), cls: "text-neg border-neg/30 bg-neg/5" };
    }
    if (["signing", "broadcast", "queued"].includes(intent.status)) {
      return { label: intent.status.toUpperCase(), cls: "text-warn border-warn/30 bg-warn/5" };
    }
    return { label: intent.status.toUpperCase(), cls: "text-fg-2 border-line" };
  }

  function displayValue(intent: IntentRow): { text: string; cls: string } {
    const p = intent.paramsJson as { amountUsd?: number };
    if (!p.amountUsd) return { text: "—", cls: "text-fg" };
    const sign = intent.kind === "withdraw" ? "-" : "+";
    const cls = intent.kind === "withdraw" ? "text-neg" : "text-accent";
    return { text: `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(p.amountUsd)}`, cls };
  }

  return (
    <div className="flex h-full relative">
      {/* Left: table */}
      <div className={`flex-1 min-w-0 overflow-auto transition-all ${selected ? "lg:mr-105" : ""}`}>
        {/* Table header */}
        <div className="px-4 sm:px-6 py-5">
          <div className="text-[10px] text-fg-3 font-mono uppercase tracking-wider mb-1">
            {t("breadcrumb" as never)}
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-fg mb-1">{t("title" as never)}</h1>
              <p className="text-xs text-fg-3 leading-relaxed max-w-lg">
                {t("description" as never)}
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-bg-0 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {t("new_intent_btn" as never)}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mx-4 sm:mx-6 mb-6 rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-fg-3">{t("history_label" as never)}</span>
            </div>
            {(confirmed > 0 || simulated > 0) && (
              <span className="text-[10px] font-mono text-fg-3">
                {confirmed > 0 && `${confirmed} ${confirmed > 1 ? t("executed_suffix_plural" as never) : t("executed_suffix" as never)}`}
                {confirmed > 0 && simulated > 0 && " · "}
                {simulated > 0 && `${simulated} ${simulated > 1 ? t("simulated_suffix_plural" as never) : t("simulated_suffix" as never)}`}
              </span>
            )}
          </div>

          {intents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xs text-fg-3 font-mono mb-1">{t("empty_title" as never)}</p>
              <p className="text-xs text-fg-3">{t("empty_desc" as never)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    {tableHeaders.map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-mono text-fg-3 uppercase tracking-wider ${i === 0 || i === 2 ? "text-left" : i < 3 ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {intents.map((intent) => {
                    const kind = KIND_BADGE[intent.kind] ?? { label: intent.kind.toUpperCase(), cls: "text-fg-2 border-line" };
                    const status = displayStatus(intent);
                    const value = displayValue(intent);
                    const isSelected = selected?.id === intent.id;
                    return (
                      <tr
                        key={intent.id}
                        onClick={() => setSelected(isSelected ? null : intent)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-accent/5 border-l-2 border-l-accent" : "hover:bg-bg-2"}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-fg">{shortId(intent.id)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${kind.cls}`}>{kind.label}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-fg-2">
                          {(intent.paramsJson as { adapterId?: string }).adapterId ?? "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${value.cls}`}>{value.text}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${status.cls}`}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[10px] text-fg-3">
                          {intent.txSignature ? shortTx(intent.txSignature) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[10px] text-fg-3">
                          {intent.onchainAt
                            ? fmtRelative(intent.onchainAt, nowLabel, yesterdayLabel, locale)
                            : intent.status === "confirmed"
                            ? fmtRelative(intent.updatedAt, nowLabel, yesterdayLabel, locale)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="fixed right-0 top-0 bottom-0 w-105 bg-bg-1 border-l border-line z-30 flex flex-col shadow-2xl">
          <IntentPanel
            intent={selected}
            walletAddress={walletAddress}
            snapshot={snapshot}
            policy={policy}
            onApprove={async () => { await onApprove(selected.id); setSelected((s) => s ? { ...s, status: "approved" } : null); }}
            onExecute={async () => { await onExecute(selected.id); setSelected(null); }}
            onReject={async ()  => { await onReject(selected.id);  setSelected(null); }}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={onCreate} />
      )}
    </div>
  );
}
