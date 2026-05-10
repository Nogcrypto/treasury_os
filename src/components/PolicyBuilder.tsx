"use client";

import { useState, useTransition } from "react";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { PolicyRule, RuleId } from "@/lib/rules-engine/types";
import { saveAndActivate, policyFromDescription } from "@/app/(app)/policy/actions";

// ── Rule metadata ─────────────────────────────────────────────────────────────

const RULE_META: Record<
  RuleId,
  { label: string; desc: string; hasParams?: boolean }
> = {
  MIN_RUNWAY_DAYS:        { label: "Runway mínimo",          desc: "Dias mínimos de caixa líquido", hasParams: true },
  MAX_CONCENTRATION_PCT:  { label: "Concentração máxima",    desc: "% máximo em um único protocolo", hasParams: true },
  MIN_LIQUID_PCT:         { label: "Liquidez mínima",        desc: "% mínimo do total em ativos líquidos", hasParams: true },
  BUCKET_TARGET:          { label: "Targets de bucket",      desc: "Respeitar alocações por categoria" },
  ALLOCATION_WHITELIST:   { label: "Whitelist de protocolos", desc: "Só alocar em protocolos aprovados", hasParams: true },
  YIELD_ONLY_EXCESS:      { label: "Yield com excedente",    desc: "Alocar em yield somente após cobrir obrigações" },
  REBALANCE_TRIGGER:      { label: "Trigger de rebalanceamento", desc: "Rebalancear quando desviar do target", hasParams: true },
};

const ADAPTER_OPTIONS = [
  { id: "kamino-usdc-devnet", label: "Kamino USDC (T1)" },
  { id: "mock-rwa-usdy",      label: "Mock RWA USDY (T2)" },
];

const PRESETS = [
  { value: "conservative" as const, label: "Conservador", color: "border-blue-400 text-blue-400 bg-blue-400/5" },
  { value: "balanced"     as const, label: "Equilibrado",  color: "border-accent text-accent bg-accent/5" },
  { value: "aggressive"   as const, label: "Agressivo",    color: "border-purple-400 text-purple-400 bg-purple-400/5" },
];

// ── Rule param editor ─────────────────────────────────────────────────────────

function ParamEditor({
  rule,
  onChange,
}: {
  rule: PolicyRule;
  onChange: (params: Record<string, unknown>) => void;
}) {
  if (!RULE_META[rule.id]?.hasParams) return null;

  switch (rule.id) {
    case "MIN_RUNWAY_DAYS": {
      const days = Number(rule.params.days ?? 90);
      return (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>runway mínimo</span><span>{days} dias</span>
          </div>
          <input
            type="range"
            min={30} max={365} step={15}
            value={days}
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
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>concentração máxima</span><span>{pct}%</span>
          </div>
          <input
            type="range" min={10} max={80} step={5}
            value={pct} disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, pct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "MIN_LIQUID_PCT": {
      const pct = Number(rule.params.pct ?? 50);
      return (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>liquidez mínima</span><span>{pct}%</span>
          </div>
          <input
            type="range" min={10} max={90} step={5}
            value={pct} disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, pct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "REBALANCE_TRIGGER": {
      const dev = Number(rule.params.deviationPct ?? 10);
      return (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>desvio para trigger</span><span>{dev}%</span>
          </div>
          <input
            type="range" min={3} max={25} step={1}
            value={dev} disabled={!rule.enabled}
            onChange={(e) => onChange({ ...rule.params, deviationPct: Number(e.target.value) })}
            className="w-full accent-accent disabled:opacity-40"
          />
        </div>
      );
    }
    case "ALLOCATION_WHITELIST": {
      const adapters = (rule.params.adapters as string[]) ?? [];
      return (
        <div className="mt-2 space-y-1">
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
}

export function PolicyBuilder({
  activeRules,
  activePreset,
  activeVersion,
}: PolicyBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState(activePreset);
  const [rules, setRules] = useState<PolicyRule[]>(activeRules);
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
    setIsDirty(true);
    setSuccess(false);
  }

  function toggleRule(id: RuleId) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    setIsDirty(true);
    setSuccess(false);
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
      setIsDirty(true);
      setSuccess(false);
      setAiDescription("");
    } finally {
      setIsAiGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Preset selector */}
      <div>
        <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-3">
          Preset de perfil de risco
        </div>
        <div className="flex gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyPreset(p.value)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-mono font-semibold transition-all ${
                selectedPreset === p.value ? p.color : "border-line text-fg-3 hover:border-fg-3"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div>
        <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-3">
          Regras — v{activeVersion}
          {isDirty && <span className="ml-2 text-warn">· modificado</span>}
        </div>
        <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
          {rules.map((rule) => {
            const meta = RULE_META[rule.id];
            return (
              <div
                key={rule.id}
                className={`px-4 py-3 transition-colors ${rule.enabled ? "bg-bg-1" : "bg-bg-0"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${rule.enabled ? "text-fg" : "text-fg-3"}`}>
                      {meta?.label ?? rule.id}
                    </div>
                    <div className="text-xs text-fg-3">{meta?.desc}</div>
                  </div>
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
                <ParamEditor rule={rule} onChange={(p) => updateParams(rule.id, p)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* AI policy generator */}
      <div className="rounded-xl border border-line bg-bg-0 p-4">
        <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-3">
          ✦ Gerar política com IA
        </div>
        <textarea
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          placeholder={'Descreva sua política em linguagem natural... ex: "Quero ser conservador, manter 6 meses de runway, no maximo 30% em um protocolo, e so usar Kamino."'}
          rows={3}
          className="w-full resize-none rounded-lg border border-line bg-bg-1 px-3 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 transition-all mb-3"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-neg">{aiError ?? ""}</div>
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isAiGenerating || !aiDescription.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 text-xs text-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isAiGenerating ? (
              <>
                <span className="inline-block w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                Gerando…
              </>
            ) : (
              "Gerar política →"
            )}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {error && <span className="text-neg">{error}</span>}
          {success && <span className="text-accent">Política ativada ✓</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending || (!isDirty && !success)}
          className="px-5 py-2 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? "Salvando…" : "Ativar política →"}
        </button>
      </div>
    </div>
  );
}
