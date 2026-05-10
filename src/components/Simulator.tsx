"use client";

import { useState, useTransition, useMemo } from "react";
import { projectRunway, projectScenario } from "@/lib/rules-engine/projections";
import type { TreasurySnapshot, Policy, ScenarioAction, ProjectionResult } from "@/lib/rules-engine/types";
import { saveRecommendation } from "@/app/(app)/simulator/actions";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function Delta({ a, b, format = (n: number) => n.toFixed(1) }: { a: number; b: number; format?: (n: number) => string }) {
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return <span className="text-fg-3">—</span>;
  return (
    <span className={diff > 0 ? "text-accent" : "text-neg"}>
      {diff > 0 ? "+" : ""}{format(diff)}
    </span>
  );
}

function MetricRow({
  label,
  baseline,
  scenario,
  formatFn,
}: {
  label: string;
  baseline: number;
  scenario: number;
  formatFn: (n: number) => string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-line last:border-0 text-sm">
      <div className="text-fg-3">{label}</div>
      <div className="font-mono text-fg text-right">{formatFn(baseline)}</div>
      <div className="font-mono text-right">
        <span className="text-fg">{formatFn(scenario)}</span>
        {" "}
        <Delta a={baseline} b={scenario} format={formatFn} />
      </div>
    </div>
  );
}

interface SimulatorProps {
  snapshot: TreasurySnapshot;
  policy: Policy;
  policyVersion: number;
}

export function Simulator({ snapshot, policy, policyVersion }: SimulatorProps) {
  const liquidMax = snapshot.liquidUsd;
  const kaminoPos = snapshot.positions.find((p) => p.adapterId === "kamino-usdc-devnet");
  const rwaPos = snapshot.positions.find((p) => p.adapterId === "mock-rwa-usdy");

  const [depositKamino, setDepositKamino] = useState(0);
  const [depositRwa, setDepositRwa] = useState(0);
  const [withdrawKamino, setWithdrawKamino] = useState(0);
  const [withdrawRwa, setWithdrawRwa] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const actions: ScenarioAction[] = useMemo(() => {
    const result: ScenarioAction[] = [];
    if (depositKamino > 0)  result.push({ kind: "deposit",  adapterId: "kamino-usdc-devnet", amountUsd: depositKamino });
    if (depositRwa > 0)     result.push({ kind: "deposit",  adapterId: "mock-rwa-usdy",      amountUsd: depositRwa });
    if (withdrawKamino > 0) result.push({ kind: "withdraw", adapterId: "kamino-usdc-devnet", amountUsd: withdrawKamino });
    if (withdrawRwa > 0)    result.push({ kind: "withdraw", adapterId: "mock-rwa-usdy",      amountUsd: withdrawRwa });
    return result;
  }, [depositKamino, depositRwa, withdrawKamino, withdrawRwa]);

  const baseline: ProjectionResult = useMemo(() => projectRunway(snapshot, policy), [snapshot, policy]);
  const scenario: ProjectionResult = useMemo(
    () => (actions.length > 0 ? projectScenario(snapshot, policy, actions) : baseline),
    [snapshot, policy, actions, baseline]
  );

  const hasChanges = actions.length > 0;

  function handleSave() {
    if (!hasChanges) return;
    setSaveError(null);
    setSaved(false);
    const rationale = `Simulação: ${actions.map((a) => `${a.kind} $${a.amountUsd.toLocaleString()} em ${a.adapterId}`).join(", ")}`;
    startTransition(async () => {
      const result = await saveRecommendation(actions, rationale);
      if (!result.ok) return setSaveError(result.error ?? "Erro ao salvar.");
      setSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-6">
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Ações simuladas
          </div>
          <div className="p-4 space-y-5">
            {/* Kamino deposits */}
            <SliderGroup
              title="Depositar em Kamino (T1 · 5.84% APR)"
              value={depositKamino}
              max={Math.max(0, liquidMax - depositRwa)}
              onChange={(v) => { setDepositKamino(v); setWithdrawKamino(0); }}
              accent="text-accent"
            />
            {/* RWA deposits */}
            <SliderGroup
              title="Depositar em Mock RWA (T2 · 4.82% APR)"
              value={depositRwa}
              max={Math.max(0, liquidMax - depositKamino)}
              onChange={(v) => { setDepositRwa(v); setWithdrawRwa(0); }}
              accent="text-accent"
            />
            {/* Kamino withdrawals */}
            {kaminoPos && kaminoPos.amountUsd > 0 && (
              <SliderGroup
                title="Sacar do Kamino"
                value={withdrawKamino}
                max={kaminoPos.amountUsd}
                onChange={(v) => { setWithdrawKamino(v); setDepositKamino(0); }}
                accent="text-warn"
              />
            )}
            {/* RWA withdrawals */}
            {rwaPos && rwaPos.amountUsd > 0 && (
              <SliderGroup
                title="Sacar do Mock RWA"
                value={withdrawRwa}
                max={rwaPos.amountUsd}
                onChange={(v) => { setWithdrawRwa(v); setDepositRwa(0); }}
                accent="text-warn"
              />
            )}

            {!kaminoPos && !rwaPos && depositKamino === 0 && depositRwa === 0 && (
              <div className="text-xs text-fg-3 text-center py-2">
                Use os sliders acima para simular movimentos de capital.
              </div>
            )}
          </div>
        </div>

        {/* Save recommendation */}
        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-neg flex-1">{saveError}</span>}
          {saved && <span className="text-xs text-accent flex-1">Salvo como recomendação ✓</span>}
          {!saveError && !saved && <span className="flex-1" />}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isPending || saved}
            className="px-4 py-2 rounded-lg border border-line text-xs text-fg-2 hover:border-accent/40 hover:bg-accent/5 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? "Salvando…" : "Salvar como recomendação →"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="grid grid-cols-3 gap-2 text-xs font-mono text-fg-3 uppercase tracking-wider">
              <div>Métrica</div>
              <div className="text-right">Atual</div>
              <div className="text-right">Simulado</div>
            </div>
          </div>
          <div className="px-4 py-2">
            <MetricRow label="Runway líquido" baseline={baseline.liquidRunwayMonths} scenario={scenario.liquidRunwayMonths} formatFn={(n) => `${n.toFixed(1)} mo`} />
            <MetricRow label="APR médio" baseline={baseline.blendedAprPct} scenario={scenario.blendedAprPct} formatFn={(n) => `${n.toFixed(2)}%`} />
            <MetricRow label="Yield anual" baseline={baseline.estimatedYieldYearUsd} scenario={scenario.estimatedYieldYearUsd} formatFn={(n) => fmtUSD(n)} />
            <MetricRow label="Concentração" baseline={baseline.topConcentrationPct} scenario={scenario.topConcentrationPct} formatFn={(n) => `${n.toFixed(1)}%`} />
            <MetricRow label="Compliance" baseline={baseline.complianceScore} scenario={scenario.complianceScore} formatFn={(n) => `${n}/100`} />
          </div>
        </div>

        {/* Violations in scenario */}
        {hasChanges && scenario.violations.length > 0 && (
          <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
            <div className="text-xs font-mono text-warn uppercase tracking-wider mb-2">
              {scenario.violations.length} violaç{scenario.violations.length > 1 ? "ões" : "ão"} no cenário
            </div>
            <ul className="space-y-1">
              {scenario.violations.map((v, i) => (
                <li key={i} className="text-xs text-fg-2 flex gap-2">
                  <span className={v.severity === "block" ? "text-neg" : "text-warn"}>▸</span>
                  {v.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasChanges && scenario.violations.length === 0 && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent font-mono">
            ✓ Cenário em conformidade com a política
          </div>
        )}
      </div>
    </div>
  );
}

// ── Slider group sub-component ────────────────────────────────────────────────

function SliderGroup({
  title,
  value,
  max,
  onChange,
  accent,
}: {
  title: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const step = Math.max(100, Math.floor(max / 100) * 10);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-fg-2">{title}</div>
        <div className={`text-xs font-mono font-semibold ${accent}`}>
          {value > 0 ? fmtUSD(value) : "—"}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step || 100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
        disabled={max <= 0}
      />
      <div className="flex justify-between text-xs text-fg-3 font-mono">
        <span>$0</span>
        <span>{fmtUSD(max)}</span>
      </div>
    </div>
  );
}
