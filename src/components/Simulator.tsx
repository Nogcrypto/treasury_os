"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  projectRunway,
  projectScenario,
  applyScenarioActions,
  estimateMonthlyBurnUsd,
} from "@/lib/rules-engine/projections";
import type { TreasurySnapshot, Policy, ScenarioAction, ProjectionResult } from "@/lib/rules-engine/types";
import { approveScenario } from "@/app/(app)/simulator/actions";

// ── Adapter metadata ──────────────────────────────────────────────────────────

const ADAPTERS = [
  {
    id: "kamino-usdc-devnet",
    label: "Kamino USDC",
    protocol: "Kamino Finance",
    aprPct: 5.84,
    riskTier: 1 as const,
    riskLabel: "T1",
    lockLabel: null as string | null,
    barColor: "bg-accent",
    textColor: "text-accent",
  },
  {
    id: "mock-rwa-usdy",
    label: "Mock RWA (USDY)",
    protocol: "Ondo Finance (USDY)",
    aprPct: 4.82,
    riskTier: 2 as const,
    riskLabel: "T2",
    lockLabel: "1D REDEEM",
    barColor: "bg-accent-3",
    textColor: "text-accent-3",
  },
  {
    id: "sol-liquid-staking",
    label: "SOL Liquid Staking",
    protocol: "Marinade Finance",
    aprPct: 7.2,
    riskTier: 3 as const,
    riskLabel: "T3",
    lockLabel: "VOL",
    barColor: "bg-warn",
    textColor: "text-warn",
  },
] as const;

type AdapterId = (typeof ADAPTERS)[number]["id"];

const ADAPTER_BY_ID = Object.fromEntries(ADAPTERS.map((a) => [a.id, a])) as Record<string, typeof ADAPTERS[number]>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function getWhitelist(policy: Policy): string[] | null {
  const rule = policy.rules.find((r) => r.id === "ALLOCATION_WHITELIST");
  if (!rule?.enabled) return null;
  const adapters = rule.params.adapters as string[] | undefined;
  return adapters && adapters.length > 0 ? adapters : null;
}

function buildActions(
  snapshot: TreasurySnapshot,
  targets: Record<AdapterId, number>
): ScenarioAction[] {
  const actions: ScenarioAction[] = [];
  for (const adapter of ADAPTERS) {
    const currentPos = snapshot.positions.find((p) => p.adapterId === adapter.id);
    const currentAmount = currentPos?.amountUsd ?? 0;
    const targetAmount = targets[adapter.id] ?? 0;
    const delta = targetAmount - currentAmount;
    if (delta > 100) {
      actions.push({
        kind: "deposit",
        adapterId: adapter.id,
        amountUsd: Math.round(delta),
        meta: { protocol: adapter.protocol, aprPct: adapter.aprPct, riskTier: adapter.riskTier, unlockDays: 0 },
      });
    } else if (delta < -100) {
      actions.push({ kind: "withdraw", adapterId: adapter.id, amountUsd: Math.round(-delta) });
    }
  }
  return actions;
}

function buildConservativeActions(snapshot: TreasurySnapshot): ScenarioAction[] {
  const kamino = ADAPTERS[0];
  const rwa = ADAPTERS[1];
  const kaminoCurrent = snapshot.positions.find((p) => p.adapterId === kamino.id)?.amountUsd ?? 0;
  const rwaCurrent = snapshot.positions.find((p) => p.adapterId === rwa.id)?.amountUsd ?? 0;

  const kaminoTarget = Math.round(snapshot.totalUsd * 0.40);
  const rwaTarget = Math.round(snapshot.totalUsd * 0.20);

  const actions: ScenarioAction[] = [];
  let availLiquid = snapshot.liquidUsd;

  const kaminoDelta = kaminoTarget - kaminoCurrent;
  if (kaminoDelta > 100 && availLiquid > 0) {
    const deposit = Math.min(kaminoDelta, availLiquid);
    actions.push({ kind: "deposit", adapterId: kamino.id, amountUsd: deposit, meta: { protocol: kamino.protocol, aprPct: kamino.aprPct, riskTier: kamino.riskTier } });
    availLiquid -= deposit;
  } else if (kaminoDelta < -100) {
    actions.push({ kind: "withdraw", adapterId: kamino.id, amountUsd: -kaminoDelta });
    availLiquid += -kaminoDelta;
  }

  const rwaDelta = rwaTarget - rwaCurrent;
  if (rwaDelta > 100 && availLiquid > 0) {
    const deposit = Math.min(rwaDelta, availLiquid);
    actions.push({ kind: "deposit", adapterId: rwa.id, amountUsd: deposit, meta: { protocol: rwa.protocol, aprPct: rwa.aprPct, riskTier: rwa.riskTier } });
  } else if (rwaDelta < -100) {
    actions.push({ kind: "withdraw", adapterId: rwa.id, amountUsd: -rwaDelta });
  }

  return actions;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricDef = {
  labelKey: string;
  baseValue: (p: ProjectionResult, l: number) => number;
  scenValue: (p: ProjectionResult, l: number) => number;
  fmt: (n: number) => string;
  fmtDelta: (d: number) => string;
  higherIsBetter: boolean;
};

const METRIC_DEFS: MetricDef[] = [
  { labelKey: "liquid_runway",    baseValue: (p) => p.liquidRunwayMonths,    scenValue: (p) => p.liquidRunwayMonths,    fmt: (n) => `${n.toFixed(1)} mo`, fmtDelta: (d) => d.toFixed(1), higherIsBetter: true },
  { labelKey: "protected_runway", baseValue: (p) => p.protectedRunwayMonths, scenValue: (p) => p.protectedRunwayMonths, fmt: (n) => `${n.toFixed(1)} mo`, fmtDelta: (d) => d.toFixed(1), higherIsBetter: true },
  { labelKey: "yield_year",       baseValue: (p) => p.estimatedYieldYearUsd, scenValue: (p) => p.estimatedYieldYearUsd, fmt: fmtUSD, fmtDelta: (d) => `${d >= 0 ? "+" : ""}${fmtUSD(Math.abs(d), true)}`, higherIsBetter: true },
  { labelKey: "blended_apr",      baseValue: (p) => p.blendedAprPct,         scenValue: (p) => p.blendedAprPct,         fmt: (n) => `${n.toFixed(2)}%`, fmtDelta: (d) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)}bps`, higherIsBetter: true },
  { labelKey: "concentration",    baseValue: (p) => p.topConcentrationPct,   scenValue: (p) => p.topConcentrationPct,   fmt: (n) => `${n.toFixed(1)}%`,  fmtDelta: (d) => d.toFixed(1), higherIsBetter: false },
  { labelKey: "compliance",       baseValue: (p) => p.complianceScore,       scenValue: (p) => p.complianceScore,       fmt: (n) => `${Math.round(n)}/100`, fmtDelta: (d) => `${d >= 0 ? "+" : ""}${Math.round(d)}`, higherIsBetter: true },
  { labelKey: "usdc_free",        baseValue: (_, l) => l,                    scenValue: (_, l) => l,                    fmt: fmtUSD, fmtDelta: (d) => `${d >= 0 ? "+" : ""}${fmtUSD(Math.abs(d), true)}`, higherIsBetter: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ProtocolCard({
  adapter,
  targetAmount,
  maxAmount,
  onChange,
  inWhitelist,
  outOfWhitelistLabel,
}: {
  adapter: typeof ADAPTERS[number];
  targetAmount: number;
  maxAmount: number;
  onChange: (v: number) => void;
  inWhitelist: boolean;
  outOfWhitelistLabel: string;
}) {
  const monthlyYield = targetAmount * (adapter.aprPct / 100) / 12;
  const step = Math.max(1_000, Math.round(maxAmount / 200) * 1_000);

  return (
    <div className="px-4 py-3 border-b border-line">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${adapter.textColor}`}>◈</span>
          <span className="text-xs font-medium text-fg">{adapter.label}</span>
        </div>
        <span className="text-xs font-semibold font-mono text-fg">{fmtUSD(targetAmount)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxAmount}
        step={step}
        value={Math.min(targetAmount, maxAmount)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mb-2 accent-accent"
        disabled={maxAmount <= 0}
      />
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] font-mono text-fg-3">APR {adapter.aprPct.toFixed(2)}%</span>
          <span className="text-[9px] font-mono text-fg-3">· RISK {adapter.riskLabel}</span>
          {adapter.lockLabel && <span className="text-[9px] font-mono text-fg-3">· {adapter.lockLabel}</span>}
          {!inWhitelist && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-warn/40 bg-warn/10 text-warn">
              {outOfWhitelistLabel}
            </span>
          )}
        </div>
        {targetAmount > 0 && (
          <span className="text-[9px] font-mono text-accent shrink-0">
            +{fmtUSD(monthlyYield, true)}/mo
          </span>
        )}
      </div>
    </div>
  );
}

function BurnCard({
  value,
  defaultValue,
  onChange,
  label,
  suffix,
}: {
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  label: string;
  suffix: string;
}) {
  const min = Math.round(defaultValue * 0.3 / 1000) * 1000;
  const max = Math.round(defaultValue * 2.5 / 1000) * 1000;
  const step = Math.max(1_000, Math.round((max - min) / 100) * 1_000);
  const isOverridden = Math.abs(value - defaultValue) > 500;

  return (
    <div className="px-4 py-3 border-b border-line">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neg">↓</span>
          <span className="text-xs font-medium text-fg">{label}</span>
          {isOverridden && (
            <span className="text-[9px] font-mono text-warn border border-warn/30 bg-warn/5 px-1.5 rounded">
              OVERRIDE
            </span>
          )}
        </div>
        <span className="text-xs font-semibold font-mono text-fg">{fmtUSD(value, true)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mb-1 accent-warn"
      />
      <div className="flex justify-between text-[9px] font-mono text-fg-3">
        <span>{fmtUSD(min, true)}{suffix}</span>
        <span>{fmtUSD(max, true)}{suffix}</span>
      </div>
    </div>
  );
}

function DeltaTag({
  baseline,
  value,
  fmtDelta,
  higherIsBetter,
}: {
  baseline: number;
  value: number;
  fmtDelta: (d: number) => string;
  higherIsBetter: boolean;
}) {
  const diff = value - baseline;
  if (Math.abs(diff) < 0.005) return <span className="text-[10px] font-mono text-fg-3">±0</span>;
  const isGood = higherIsBetter ? diff > 0 : diff < 0;
  return (
    <span className={`text-[10px] font-mono ${isGood ? "text-accent" : "text-neg"}`}>
      {fmtDelta(diff)}
    </span>
  );
}

function BaselineColumn({
  proj,
  liquidUsd,
  policyVersion,
}: {
  proj: ProjectionResult;
  liquidUsd: number;
  policyVersion: number;
}) {
  const t = useTranslations("simulator");
  return (
    <div className="min-w-52 border-r border-line flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">
          {t("baseline_label" as never)}
        </span>
        <span className="text-[9px] font-mono bg-bg-2 border border-line rounded px-1.5 py-0.5 text-fg-3">v{policyVersion}</span>
      </div>
      {METRIC_DEFS.map((m) => (
        <div key={m.labelKey} className="px-4 py-3 border-b border-line last:border-0 flex items-center justify-between">
          <span className="text-xs text-fg-3">{t(`metrics.${m.labelKey}` as never)}</span>
          <span className="text-xs font-mono text-fg font-semibold">{m.fmt(m.baseValue(proj, liquidUsd))}</span>
        </div>
      ))}
    </div>
  );
}

function ScenarioColumn({
  id,
  sublabel,
  proj,
  baseline,
  liquidUsd,
  baselineLiquidUsd,
  isSelected,
  isRecommended,
  violations,
  onClick,
}: {
  id: "a" | "b";
  sublabel: string;
  proj: ProjectionResult;
  baseline: ProjectionResult;
  liquidUsd: number;
  baselineLiquidUsd: number;
  isSelected: boolean;
  isRecommended?: boolean;
  violations: typeof proj.violations;
  onClick: () => void;
}) {
  const t = useTranslations("simulator");
  return (
    <div
      onClick={onClick}
      className={`min-w-44 flex flex-col shrink-0 cursor-pointer border-r border-line transition-colors ${
        isSelected && isRecommended
          ? "border-l-2 border-l-accent bg-accent/3"
          : isSelected
          ? "bg-bg-2"
          : "hover:bg-bg-2/50"
      }`}
    >
      <div className={`px-4 py-3 border-b border-line flex items-center justify-between ${isRecommended && isSelected ? "border-accent/20" : ""}`}>
        <div>
          <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">
            {t("scenario_col_label" as never)} {id.toUpperCase()} · {sublabel}
          </span>
          {isRecommended && (
            <span className="ml-1 text-[9px] text-accent">★</span>
          )}
        </div>
        {violations.length > 0 && (
          <span className="text-[9px] font-mono text-neg border border-neg/30 bg-neg/5 px-1.5 rounded">
            {violations.length}✕
          </span>
        )}
      </div>
      {METRIC_DEFS.map((m) => {
        const bVal = m.baseValue(baseline, baselineLiquidUsd);
        const sVal = m.scenValue(proj, liquidUsd);
        return (
          <div key={m.labelKey} className="px-4 py-3 border-b border-line last:border-0 text-right">
            <div className="text-xs font-mono text-fg font-semibold">{m.fmt(sVal)}</div>
            <DeltaTag baseline={bVal} value={sVal} fmtDelta={m.fmtDelta} higherIsBetter={m.higherIsBetter} />
          </div>
        );
      })}
    </div>
  );
}

function BeforeAfterBar({
  label,
  positions,
  liquidUsd,
  totalUsd,
  liquidUsdLabel,
}: {
  label: string;
  positions: TreasurySnapshot["positions"];
  liquidUsd: number;
  totalUsd: number;
  liquidUsdLabel: string;
}) {
  if (totalUsd <= 0) return null;

  const segments: { id: string; label: string; pct: number; color: string }[] = [];
  if (liquidUsd > 0) {
    segments.push({ id: "liquid", label: liquidUsdLabel, pct: liquidUsd / totalUsd, color: "bg-bg-3" });
  }
  for (const pos of positions) {
    if (pos.amountUsd <= 0) continue;
    const meta = ADAPTER_BY_ID[pos.adapterId];
    segments.push({
      id: pos.adapterId,
      label: `${meta?.label ?? pos.adapterId.toUpperCase()} · ${pos.aprPct.toFixed(2)}%`,
      pct: pos.amountUsd / totalUsd,
      color: meta?.barColor ?? "bg-fg-3",
    });
  }

  return (
    <div>
      <div className="text-[9px] font-mono text-fg-3 uppercase mb-1.5">{label}</div>
      <div className="flex h-9 rounded overflow-hidden gap-px">
        {segments.map((seg) => (
          <div
            key={seg.id}
            style={{ flex: seg.pct }}
            className={`${seg.color} flex items-center px-2 text-[9px] font-mono truncate ${seg.color === "bg-bg-3" ? "text-fg-3" : "text-bg-0"}`}
          >
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SimulatorProps {
  snapshot: TreasurySnapshot;
  policy: Policy;
  policyVersion: number;
}

export function Simulator({ snapshot, policy, policyVersion }: SimulatorProps) {
  const t = useTranslations("simulator");
  const defaultBurn = useMemo(() => estimateMonthlyBurnUsd(snapshot), [snapshot]);

  const [targets, setTargets] = useState<Record<AdapterId, number>>(() => {
    const tgt: Record<string, number> = {};
    for (const a of ADAPTERS) {
      const pos = snapshot.positions.find((p) => p.adapterId === a.id);
      tgt[a.id] = pos?.amountUsd ?? 0;
    }
    return tgt as Record<AdapterId, number>;
  });
  const [burnSlider, setBurnSlider] = useState(defaultBurn);
  const [selected, setSelected] = useState<"a" | "b">("b");
  const [approved, setApproved] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const whitelist = useMemo(() => getWhitelist(policy), [policy]);

  const scenarioAActions = useMemo(() => buildConservativeActions(snapshot), [snapshot]);
  const scenarioBActions = useMemo(
    () => buildActions(snapshot, targets),
    [snapshot, targets]
  );

  const baseline = useMemo(() => projectRunway(snapshot, policy, burnSlider), [snapshot, policy, burnSlider]);
  const scenarioA = useMemo(() => projectScenario(snapshot, policy, scenarioAActions, burnSlider), [snapshot, policy, scenarioAActions, burnSlider]);
  const scenarioB = useMemo(() => projectScenario(snapshot, policy, scenarioBActions, burnSlider), [snapshot, policy, scenarioBActions, burnSlider]);

  const { liquidUsd: aLiquidUsd, positions: aPositions } = useMemo(
    () => applyScenarioActions(snapshot, scenarioAActions),
    [snapshot, scenarioAActions]
  );
  const { liquidUsd: bLiquidUsd, positions: bPositions } = useMemo(
    () => applyScenarioActions(snapshot, scenarioBActions),
    [snapshot, scenarioBActions]
  );

  const narrative = useMemo(() => {
    const actions = scenarioBActions;
    const proj = scenarioB;
    if (actions.length === 0) return t("no_changes" as never);
    const totalDeposit = actions.filter((a) => a.kind === "deposit").reduce((s, a) => s + a.amountUsd, 0);
    const yieldDelta = proj.estimatedYieldYearUsd - baseline.estimatedYieldYearUsd;
    const scoreDelta = Math.round(proj.complianceScore - baseline.complianceScore);
    const parts: string[] = [];
    if (totalDeposit > 0) {
      parts.push(
        t("narrative.allocates" as never, {
          amount: fmtUSD(totalDeposit, true),
          months: proj.protectedRunwayMonths.toFixed(1),
        } as never)
      );
    }
    if (yieldDelta > 0) {
      parts.push(t("narrative.yield_delta" as never, { amount: fmtUSD(yieldDelta, true) } as never));
    }
    if (scoreDelta > 0) {
      parts.push(t("narrative.compliance_up" as never, { score: Math.round(proj.complianceScore) } as never));
    } else if (scoreDelta < 0) {
      parts.push(t("narrative.compliance_down" as never, { score: Math.round(proj.complianceScore) } as never));
    }
    if (proj.violations.length > 0) {
      parts.push(t("narrative.violations" as never, { count: proj.violations.length } as never));
    }
    return parts.join(" ") || t("scenario_valid" as never);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioBActions, scenarioB, baseline, bLiquidUsd, t]);

  function handleReset() {
    const tgt: Record<string, number> = {};
    for (const a of ADAPTERS) {
      const pos = snapshot.positions.find((p) => p.adapterId === a.id);
      tgt[a.id] = pos?.amountUsd ?? 0;
    }
    setTargets(tgt as Record<AdapterId, number>);
    setBurnSlider(defaultBurn);
    setApproved(false);
    setApproveError(null);
  }

  function handleApprove() {
    if (approved || scenarioBActions.length === 0) return;
    setApproveError(null);
    startTransition(async () => {
      const res = await approveScenario(scenarioBActions, narrative);
      if (res.ok) setApproved(true);
      else setApproveError(res.error ?? t("error_approve" as never));
    });
  }

  const hasChanges = scenarioBActions.length > 0;

  function maxForAdapter(adapterId: AdapterId): number {
    const pos = snapshot.positions.find((p) => p.adapterId === adapterId);
    return (pos?.amountUsd ?? 0) + snapshot.liquidUsd;
  }

  const liquidUsdLabel = t("liquid_usdc_label" as never);
  const outOfWhitelistLabel = t("out_of_whitelist" as never);
  const burnLabel = t("monthly_burn_label" as never);
  const burnSuffix = t("monthly_burn_suffix" as never);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-widest mb-1">
            {t("breadcrumb" as never)}
          </div>
          <h1 className="text-base font-semibold text-fg mb-0.5">
            {t("title" as never)} · simulate_scenario()
          </h1>
          <p className="text-[11px] text-fg-3 max-w-lg leading-relaxed">
            {t("description" as never)}{" "}
            <code className="font-mono bg-bg-2 border border-line rounded px-1 py-px text-fg-2">
              projectRunway(snapshot, obligations, policy)
            </code>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-3 hover:text-fg hover:border-accent/40 transition-colors"
          >
            {t("reset_btn" as never)}
          </button>
          {approveError && <span className="text-xs text-neg">{approveError}</span>}
          <button
            onClick={handleApprove}
            disabled={!hasChanges || approved}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg-0 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {approved
              ? t("approved_msg" as never)
              : `${t("approve_btn" as never)} ${selected.toUpperCase()}`}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Variables panel */}
        <div className="w-56 border-r border-line flex flex-col overflow-y-auto shrink-0">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">
              ⊙ {t("variables_label" as never)}
            </span>
            <span className="text-[9px] font-mono text-accent uppercase">
              {t("scenario_b_label" as never)}
            </span>
          </div>

          {ADAPTERS.map((adapter) => (
            <ProtocolCard
              key={adapter.id}
              adapter={adapter}
              targetAmount={targets[adapter.id] ?? 0}
              maxAmount={maxForAdapter(adapter.id)}
              onChange={(v) => setTargets((prev) => ({ ...prev, [adapter.id]: v }))}
              inWhitelist={!whitelist || whitelist.includes(adapter.id)}
              outOfWhitelistLabel={outOfWhitelistLabel}
            />
          ))}

          <BurnCard
            value={burnSlider}
            defaultValue={defaultBurn}
            onChange={setBurnSlider}
            label={burnLabel}
            suffix={burnSuffix}
          />
        </div>

        {/* Right: Comparison columns */}
        <div className="flex-1 overflow-x-auto flex">
          <BaselineColumn
            proj={baseline}
            liquidUsd={snapshot.liquidUsd}
            policyVersion={policyVersion}
          />
          <ScenarioColumn
            id="a"
            sublabel={t("scenarios.conservative_label" as never)}
            proj={scenarioA}
            baseline={baseline}
            liquidUsd={aLiquidUsd}
            baselineLiquidUsd={snapshot.liquidUsd}
            isSelected={selected === "a"}
            violations={scenarioA.violations}
            onClick={() => setSelected("a")}
          />
          <ScenarioColumn
            id="b"
            sublabel={t("scenarios.recommended_label" as never)}
            proj={scenarioB}
            baseline={baseline}
            liquidUsd={bLiquidUsd}
            baselineLiquidUsd={snapshot.liquidUsd}
            isSelected={selected === "b"}
            isRecommended
            violations={scenarioB.violations}
            onClick={() => setSelected("b")}
          />
        </div>
      </div>

      {/* Bottom: before/after visualization */}
      <div className="border-t border-line shrink-0">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider">
              ⊙ {t("before_after_title" as never)}
            </span>
            <span className="text-[9px] font-mono text-fg-3 uppercase">
              {t("after_scenario_label" as never, { id: selected.toUpperCase() } as never)}
            </span>
          </div>
          <div className="space-y-2.5">
            <BeforeAfterBar
              label={t("before_label" as never)}
              positions={snapshot.positions}
              liquidUsd={snapshot.liquidUsd}
              totalUsd={snapshot.totalUsd}
              liquidUsdLabel={liquidUsdLabel}
            />
            <BeforeAfterBar
              label={`${t("after_label" as never)} (${t("scenario_col_label" as never)} ${selected.toUpperCase()})`}
              positions={selected === "b" ? bPositions : aPositions}
              liquidUsd={selected === "b" ? bLiquidUsd : aLiquidUsd}
              totalUsd={snapshot.totalUsd}
              liquidUsdLabel={liquidUsdLabel}
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line flex items-start gap-4">
          <span className="text-[9px] font-mono text-fg-3 uppercase tracking-wider shrink-0 mt-0.5">
            {t("narrative_label" as never)}
          </span>
          <p className="text-[11px] text-fg-2 leading-relaxed">{narrative}</p>
        </div>
      </div>
    </div>
  );
}
