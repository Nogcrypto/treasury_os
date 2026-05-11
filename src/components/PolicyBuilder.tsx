"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
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

const PRESET_KEYS = ["conservative", "balanced", "aggressive"] as const;
type PresetKey = typeof PRESET_KEYS[number];

const PRESET_ICONS: Record<PresetKey, string> = {
  conservative: "○",
  balanced: "◎",
  aggressive: "◇",
};

const ADAPTER_OPTIONS = [
  { id: "kamino-usdc-devnet", label: "Kamino USDC (T1)" },
  { id: "mock-rwa-usdy",      label: "Mock RWA USDY (T2)" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVersionDate(isoDate: string | null, todayLabel: string, locale: string): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  const now = new Date();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  if (date.toDateString() === now.toDateString()) return `${todayLabel} ${hh}:${mm}`;
  const fmtLocale = locale === "en" ? "en-US" : "pt-BR";
  return (
    date.toLocaleDateString(fmtLocale, { day: "numeric", month: "short" }) +
    ` ${hh}:${mm}`
  );
}

// ── Param editor ──────────────────────────────────────────────────────────────

function ParamEditor({
  rule,
  onChange,
  paramLabel,
  daysUnit,
}: {
  rule: PolicyRule;
  onChange: (params: Record<string, unknown>) => void;
  paramLabel: string;
  daysUnit?: string;
}) {
  switch (rule.id) {
    case "MIN_RUNWAY_DAYS": {
      const days = Number(rule.params.days ?? 90);
      return (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-fg-3 font-mono">
            <span>{paramLabel}</span>
            <span className="text-fg-2">{days} {daysUnit}</span>
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
            <span>{paramLabel}</span><span className="text-fg-2">{pct}%</span>
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
            <span>{paramLabel}</span><span className="text-fg-2">{pct}%</span>
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
            <span>{paramLabel}</span><span className="text-fg-2">{dev}%</span>
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
  const t = useTranslations("policy");
  const tCommon = useTranslations("common");
  const locale = useLocale();

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

  function getRuleValue(rule: PolicyRule): string {
    switch (rule.id) {
      case "MIN_RUNWAY_DAYS": {
        const days = Number(rule.params.days ?? 90);
        return `${days} ${tCommon("days")}`;
      }
      case "MAX_CONCENTRATION_PCT":
        return `${rule.params.pct}%`;
      case "MIN_LIQUID_PCT":
        return `${rule.params.pct}%`;
      case "BUCKET_TARGET":
        return t("rule_values.assets" as never);
      case "ALLOCATION_WHITELIST": {
        const adapters = (rule.params.adapters as string[]) ?? [];
        if (adapters.length === 0) return t("rule_values.none" as never);
        return adapters
          .map((a) => (a.includes("kamino") ? "Kamino" : "USDY"))
          .join(", ");
      }
      case "YIELD_ONLY_EXCESS":
        return rule.enabled
          ? t("rule_values.active" as never)
          : t("rule_values.inactive" as never);
      case "REBALANCE_TRIGGER":
        return `${rule.params.deviationPct}%`;
      default:
        return "—";
    }
  }

  function applyPreset(preset: PresetKey) {
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
      if (!result.ok) return setError(result.error ?? t("error_save" as never));
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
        setAiError(result.error ?? t("ai_error" as never));
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

  const presetLabel = t(`presets.${selectedPreset}.label` as never);

  return (
    <div className="flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-line">
        <div className="text-[10px] font-mono text-fg-3 tracking-widest uppercase mb-1">
          {t("breadcrumb" as never)}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-fg leading-tight">
              {t("title_prefix" as never)}{activeVersion}
              <span className="text-fg-3 font-normal"> · {presetLabel}</span>
              {isDirty && (
                <span className="ml-2 text-xs text-warn font-mono">
                  {t("modified" as never)}
                </span>
              )}
            </h1>
            <p className="text-xs text-fg-3 mt-0.5 max-w-xl">
              {t("description" as never)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-3 hover:border-fg-3 transition-all font-mono"
            >
              <span>□</span> {t("versions_title" as never)} ({versions.length})
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-3 hover:border-fg-3 transition-all"
            >
              {t("edit_text_btn" as never)}
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
                  {t("saving" as never)}
                </>
              ) : success ? (
                t("activated" as never)
              ) : (
                t("save_activate" as never)
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
              {t("presets_label" as never)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_KEYS.map((presetKey) => {
                const isActive = activePreset === presetKey;
                const isSelected = selectedPreset === presetKey;
                const metrics = [
                  { label: t(`presets.${presetKey}.runway_label` as never), value: t(`presets.${presetKey}.runway_value` as never) },
                  { label: t(`presets.${presetKey}.conc_label` as never),   value: t(`presets.${presetKey}.conc_value` as never) },
                  { label: t(`presets.${presetKey}.liquid_label` as never), value: t(`presets.${presetKey}.liquid_value` as never) },
                  { label: t(`presets.${presetKey}.whitelist_label` as never), value: t(`presets.${presetKey}.whitelist_value` as never) },
                ];
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => applyPreset(presetKey)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-line bg-bg-1 hover:border-fg-3"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isSelected ? "text-accent" : "text-fg-3"}`}>
                          {PRESET_ICONS[presetKey]}
                        </span>
                        <span className={`text-sm font-semibold ${isSelected ? "text-fg" : "text-fg-2"}`}>
                          {t(`presets.${presetKey}.label` as never)}
                        </span>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/5">
                          {t("preset_active_badge" as never)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-fg-3 mb-3 leading-relaxed">
                      {t(`presets.${presetKey}.description` as never)}
                    </p>
                    <div className="space-y-1">
                      {metrics.map((m) => (
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
                  {t("rules_label" as never)}
                </span>
                <span className="text-[10px] font-mono text-fg-3">
                  {rules.length} {t("rules_validated" as never)}
                </span>
              </div>
              <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
                {rules.map((rule) => {
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
                        {/* Toggle indicator */}
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
                            {t(`rules.${rule.id}.label` as never)}
                          </div>
                          <div className="text-[10px] text-fg-3 font-mono mt-0.5">
                            {t(`rules.${rule.id}.desc` as never)} · {rule.id}
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
                          <ParamEditor
                            rule={rule}
                            onChange={(p) => updateParams(rule.id, p)}
                            paramLabel={t(`rules.${rule.id}.param_label` as never)}
                            daysUnit={rule.id === "MIN_RUNWAY_DAYS" ? tCommon("days") : undefined}
                          />
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
                  <span className="text-xs font-medium text-fg">
                    {t("text_editor_title" as never)}
                  </span>
                  <span className="text-[10px] font-mono text-fg-3">
                    {t("text_editor_model" as never)}
                  </span>
                </div>
                <div className="bg-bg-0 p-3">
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder={t("text_editor_placeholder" as never)}
                    rows={5}
                    className="w-full resize-none bg-transparent text-sm text-fg placeholder:text-fg-3 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-line bg-bg-1">
                  <span className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">
                    {t("text_editor_footer" as never)}
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
                        {t("generating_btn" as never)}
                      </>
                    ) : (
                      t("generate_btn" as never)
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
                    <span className="text-xs font-medium text-fg">
                      {t("versions_title" as never)}
                    </span>
                    <span className="text-[10px] font-mono text-fg-3">
                      {t("audit_log_label" as never)}
                    </span>
                  </div>
                  <div className="divide-y divide-line">
                    {versions.map((v) => (
                      <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-bg-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-fg-3 shrink-0">v{v.version}</span>
                          <span className="text-xs text-fg-2 truncate">
                            {v.authorLabel ?? t(`presets.${v.preset}.label` as never)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {v.activatedAt && (
                            <span className="text-[10px] font-mono text-fg-3">
                              {formatVersionDate(v.activatedAt, tCommon("today"), locale)}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              v.status === "active"
                                ? "text-accent border-accent/30 bg-accent/5"
                                : "text-fg-3 border-line opacity-60"
                            }`}
                          >
                            {v.status === "active"
                              ? t("preset_active_badge" as never)
                              : tCommon("archived")}
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
