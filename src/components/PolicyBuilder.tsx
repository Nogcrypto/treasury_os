"use client";

import { useState, useTransition } from "react";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { PolicyRule, RuleId } from "@/lib/rules-engine/types";
import { saveAndActivate, policyFromDescription } from "@/app/(app)/policy/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type PolicyVersion = {
  id: string;
  version: number;
  status: "draft" | "active" | "archived";
  preset: string;
  activatedAt: string | null;
  authorLabel?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RULE_META: Record<RuleId, { label: string; desc: string; key: string }> = {
  MIN_RUNWAY_DAYS:       { label: "Runway mínimo protegido",        desc: "dias de operação cobertos por reserva",       key: "MIN_RUNWAY_DAYS" },
  MAX_CONCENTRATION_PCT: { label: "Concentração máxima por protocolo", desc: "exposição máxima a um adapter",            key: "MAX_CONCENTRATION_PCT" },
  MIN_LIQUID_PCT:        { label: "Mínimo líquido",                 desc: "% mantido em USDC sem lock-up",              key: "MIN_LIQUID_PCT" },
  BUCKET_TARGET:         { label: "Metas por bucket",               desc: "operating, payroll, tax, emergency",         key: "BUCKET_TARGET" },
  ALLOCATION_WHITELIST:  { label: "Whitelist de adapters",          desc: "protocolos permitidos para alocação",        key: "ALLOCATION_WHITELIST" },
  YIELD_ONLY_EXCESS:     { label: "Yield apenas no excedente",      desc: "buckets protegidos não rendem",              key: "YIELD_ONLY_EXCESS" },
  REBALANCE_TRIGGER:     { label: "Trigger de rebalance",           desc: "% de desvio que dispara recomendação",       key: "REBALANCE_TRIGGER" },
};

const ADAPTER_OPTIONS = [
  { id: "kamino-usdc-devnet", label: "Kamino USDC (T1)" },
  { id: "mock-rwa-usdy",      label: "Mock RWA USDY (T2)" },
];

const PRESET_CARDS = [
  {
    value: "conservative" as const,
    label: "Conservadora",
    icon: "○",
    description: "4 meses protegidos. 30% máx por protocolo. Apenas excedente alocável.",
    metrics: [
      { label: "runway min.",   value: "4 meses" },
      { label: "conc. máx.",    value: "30%" },
      { label: "líquido min.",  value: "70%" },
      { label: "whitelist",     value: "1 adapter" },
    ],
  },
  {
    value: "balanced" as const,
    label: "Balanceada",
    icon: "◎",
    description: "3 meses protegidos. 45% máx por protocolo. Yield em 2 níveis.",
    metrics: [
      { label: "runway min.",   value: "3 meses" },
      { label: "conc. máx.",    value: "45%" },
      { label: "líquido mín.",  value: "50%" },
      { label: "whitelist",     value: "2 adapters" },
    ],
  },
  {
    value: "aggressive" as const,
    label: "Agressiva",
    icon: "◇",
    description: "2 meses protegidos. 60% máx por protocolo. Inclui RWA tier 2.",
    metrics: [
      { label: "runway min.",   value: "2 meses" },
      { label: "conc. máx.",    value: "60%" },
      { label: "líquido mín.",  value: "35%" },
      { label: "whitelist",     value: "2 adapters" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRuleValue(rule: PolicyRule): string {
  switch (rule.id) {
    case "MIN_RUNWAY_DAYS": {
      const days = Number(rule.params.days ?? 90);
      return `${days} dias`;
    }
    case "MAX_CONCENTRATION_PCT":
      return `${rule.params.pct}%`;
    case "MIN_LIQUID_PCT":
      return `${rule.params.pct}%`;
    case "BUCKET_TARGET":
      return "5 ativos";
    case "ALLOCATION_WHITELIST": {
      const adapters = (rule.params.adapters as string[]) ?? [];
      if (adapters.length === 0) return "nenhum";
      return adapters
        .map((a) => (a.includes("kamino") ? "Kamino" : "USDY"))
        .join(", ");
    }
    case "YIELD_ONLY_EXCESS":
      return rule.enabled ? "ativo" : "inativo";
    case "REBALANCE_TRIGGER":
      return `${rule.params.deviationPct}%`;
    default:
      return "—";
  }
}

function formatVersionDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  const now = new Date();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  if (date.toDateString() === now.toDateString()) return `hoje ${hh}:${mm}`;
  return (
    date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) +
    ` ${hh}:${mm}`
  );
}

function presetDisplayName(preset: string): string {
  return preset === "conservative" ? "Conservadora"
       : preset === "balanced"     ? "Balanceada"
       : preset === "aggressive"   ? "Agressiva"
       : preset.charAt(0).toUpperCase() + preset.slice(1);
}

// ── Param editor ──────────────────────────────────────────────────────────────

function ParamEditor({
  rule,
  onChange,
}: {
  rule: PolicyRule;
  onChange: (params: Record<string, unknown>) => void;
}) {
  switch (rule.id) {
    case "MIN_RUNWAY_DAYS": {
      const days = Number(rule.params.days ?? 90);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>runway mínimo</span><span className="text-fg-2">{days} dias</span>
          </div>
          <input
            type="range" min={30} max={365} step={15} value={days}
            disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, days: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "MAX_CONCENTRATION_PCT": {
      const pct = Number(rule.params.pct ?? 45);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>concentração máxima</span><span className="text-fg-2">{pct}%</span>
          </div>
          <input
            type="range" min={10} max={80} step={5} value={pct}
            disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, pct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "MIN_LIQUID_PCT": {
      const pct = Number(rule.params.pct ?? 50);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>liquidez mínima</span><span className="text-fg-2">{pct}%</span>
          </div>
          <input
            type="range" min={10} max={90} step={5} value={pct}
            disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, pct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "REBALANCE_TRIGGER": {
      const dev = Number(rule.params.deviationPct ?? 10);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>desvio para trigger</span><span className="text-fg-2">{dev}%</span>
          </div>
          <input
            type="range" min={3} max={25} step={1} value={dev}
            disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, deviationPct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "ALLOCATION_WHITELIST": {
      const adapters = (rule.params.adapters as string[]) ?? [];
      return (
        <div className="mt-3 space-y-1.5">
          {ADAPTER_OPTIONS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-xs text-fg-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adapters.includes(a.id)}
                disabled={!rule.enabled}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...adapters, a.id]
                    : adapters.filter((x) => x !== a.id);
                  onChange({ ...rule.params, adapters: next });
                }}
                className="accent-accent"
              />
              {a.label}
            </label>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface PolicyBuilderProps {
  activeRules: PolicyRule[];
  activePreset: string;
  activeVersion: number;
  versions: PolicyVersion[];
}

export function PolicyBuilder({
  activeRules,
  activePreset,
  activeVersion,
  versions,
}: PolicyBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState(activePreset);
  const [rules, setRules] = useState<PolicyRule[]>(activeRules);
  const [expandedRule, setExpandedRule] = useState<RuleId | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [aiDescription, setAiDescription] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function applyPreset(preset: "conservative" | "balanced" | "aggressive") {
    setSelectedPreset(preset);
    setRules(POLICY_PRESETS[preset].rules as PolicyRule[]);
    setExpandedRule(null);
    setIsDirty(true);
    setSuccess(false);
  }

  function toggleRule(id: RuleId) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setIsDirty(true);
    setSuccess(false);
  }

  function toggleExpanded(id: RuleId) {
    setExpandedRule((prev) => (prev === id ? null : id));
  }

  function updateParams(id: RuleId, params: Record<string, unknown>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, params } : r)));
    setIsDirty(true);
    setSuccess(false);
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveAndActivate(selectedPreset, rules);
      if (!result.ok) return setError(result.error ?? "Erro ao salvar.");
      setIsDirty(false);
      setSuccess(true);
    });
  }

  async function handleAiGenerate() {
    if (!aiDescription.trim()) return;
    setAiError(null);
    setIsAiGenerating(true);
    try {
      const result = await policyFromDescription(aiDescription);
      if (!result.ok || !result.rules) {
        setAiError(result.error ?? "Falha ao gerar.");
        return;
      }
      setRules(result.rules);
      if (result.preset) setSelectedPreset(result.preset);
      setExpandedRule(null);
      setIsDirty(true);
      setSuccess(false);
      setAiDescription("");
    } finally {
      setIsAiGenerating(false);
    }
  }

  const presetLabel = presetDisplayName(selectedPreset);

  return (
    <div className="flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-line">
        <div className="text-[10px] font-mono text-fg-3 tracking-widest uppercase mb-1">
          Workspace / Policy Engine
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-fg leading-tight">
              Policy v{activeVersion}
              <span className="text-fg-3 font-normal"> · {presetLabel}</span>
              {isDirty && <span className="ml-2 text-xs text-warn font-mono">· modificado</span>}
            </h1>
            <p className="text-xs text-fg-3 mt-0.5 max-w-xl">
              A IA propõe e explica. O rules-engine determinístico valida antes de virar intent.
              Mudanças geram nova versão com diff e audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-3 hover:border-fg-3 transition-all font-mono"
            >
              <span>□</span> Versões ({versions.length})
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-3 hover:border-fg-3 transition-all"
            >
              ✎ Editar via texto
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || (!isDirty && !success)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
            >
              {isPending ? (
                <>
                  <span className="inline-block w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                  Salvando…
                </>
              ) : success ? (
                "✓ Ativada"
              ) : (
                "✓ Ativar policy"
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-neg mt-2">{error}</p>}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div>
        <div className="px-6 py-5 space-y-5">

          {/* ── Presets ──────────────────────────────────────────────── */}
          <div>
            <div className="text-[10px] font-mono text-fg-3 tracking-widest uppercase mb-3">
              Presets
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_CARDS.map((p) => {
                const isActive = activePreset === p.value;
                const isSelected = selectedPreset === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-line bg-bg-1 hover:border-fg-3"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isSelected ? "text-accent" : "text-fg-3"}`}>
                          {p.icon}
                        </span>
                        <span className={`text-sm font-semibold ${isSelected ? "text-fg" : "text-fg-2"}`}>
                          {p.label}
                        </span>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/5">
                          ATIVA
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-fg-3 mb-3 leading-relaxed">{p.description}</p>
                    <div className="space-y-1">
                      {p.metrics.map((m) => (
                        <div key={m.label} className="flex items-center justify-between">
                          <span className="text-[10px] text-fg-3 font-mono">{m.label}</span>
                          <span className={`text-[10px] font-mono font-medium ${isSelected ? "text-fg-2" : "text-fg-3"}`}>
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Two-column grid ──────────────────────────────────────── */}
          <div className="grid grid-cols-[1fr_320px] gap-5 items-start">

            {/* Left: Rules list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-fg-3 tracking-widest uppercase">
                  Regras primitivas
                </span>
                <span className="text-[10px] font-mono text-fg-3">
                  {rules.length} TIPOS · ZOD-VALIDATED
                </span>
              </div>
              <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
                {rules.map((rule) => {
                  const meta = RULE_META[rule.id];
                  const isExpanded = expandedRule === rule.id;
                  const hasParams = [
                    "MIN_RUNWAY_DAYS",
                    "MAX_CONCENTRATION_PCT",
                    "MIN_LIQUID_PCT",
                    "REBALANCE_TRIGGER",
                    "ALLOCATION_WHITELIST",
                  ].includes(rule.id);

                  return (
                    <div
                      key={rule.id}
                      className={`px-4 py-3 transition-colors ${
                        rule.enabled ? "bg-bg-1" : "bg-bg-0"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox (visual only, rule toggle is the actual control) */}
                        <div
                          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                            rule.enabled
                              ? "border-accent bg-accent/10"
                              : "border-line"
                          }`}
                        >
                          {rule.enabled && (
                            <span className="text-accent text-[10px] leading-none">✓</span>
                          )}
                        </div>

                        {/* Label + description */}
                        <button
                          type="button"
                          onClick={() => hasParams && toggleExpanded(rule.id)}
                          className={`flex-1 min-w-0 text-left ${hasParams ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <div className={`text-sm font-medium leading-tight ${rule.enabled ? "text-fg" : "text-fg-3"}`}>
                            {meta?.label ?? rule.id}
                          </div>
                          <div className="text-[10px] text-fg-3 font-mono mt-0.5">
                            {meta?.desc} · {meta?.key}
                          </div>
                        </button>

                        {/* Value badge */}
                        <span className={`text-xs font-mono shrink-0 ${rule.enabled ? "text-fg-2" : "text-fg-3"}`}>
                          {getRuleValue(rule)}
                        </span>

                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleRule(rule.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            rule.enabled ? "bg-accent" : "bg-line"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-0 transition-transform ${
                              rule.enabled ? "translate-x-4.5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Expanded param editor */}
                      {isExpanded && hasParams && (
                        <div className="mt-1 pl-7">
                          <ParamEditor rule={rule} onChange={(p) => updateParams(rule.id, p)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Text editor */}
              <div className="rounded-xl border border-line overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-bg-1">
                  <span className="text-xs font-medium text-fg">Editar via texto</span>
                  <span className="text-[10px] font-mono text-fg-3">OPUS 4.7 · TOOL USE</span>
                </div>
                <div className="bg-bg-0 p-3">
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder="Quero 4 meses protegidos, sem mais de 30% num protocolo, aplica só o excedente."
                    rows={5}
                    className="w-full resize-none bg-transparent text-sm text-fg placeholder:text-fg-3 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-line bg-bg-1">
                  <span className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">
                    Rules-engine valida antes de salvar
                  </span>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || !aiDescription.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 text-[11px] text-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    {isAiGenerating ? (
                      <>
                        <span className="inline-block w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      <>✦ Gerar JSON</>
                    )}
                  </button>
                </div>
                {aiError && (
                  <p className="px-4 pb-3 text-xs text-neg">{aiError}</p>
                )}
              </div>

              {/* Versions / audit log */}
              {versions.length > 0 && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-bg-1">
                    <span className="text-xs font-medium text-fg">Versões</span>
                    <span className="text-[10px] font-mono text-fg-3">AUDIT LOG</span>
                  </div>
                  <div className="divide-y divide-line">
                    {versions.map((v) => (
                      <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-bg-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-fg-3 shrink-0">v{v.version}</span>
                          <span className="text-xs text-fg-2 truncate">
                            {v.authorLabel ?? presetDisplayName(v.preset)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {v.activatedAt && (
                            <span className="text-[10px] font-mono text-fg-3">
                              {formatVersionDate(v.activatedAt)}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              v.status === "active"
                                ? "text-accent border-accent/30 bg-accent/5"
                                : "text-fg-3 border-line opacity-60"
                            }`}
                          >
                            {v.status === "active" ? "ATIVA" : "ARQUIVADA"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
