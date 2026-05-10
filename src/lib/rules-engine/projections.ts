// Pure projection functions — no I/O, 100% testable

import type {
  TreasurySnapshot,
  Policy,
  ProjectionResult,
  ScenarioAction,
  PolicyViolation,
  PolicyRule,
} from "./types";

const MONTHS_PER_YEAR = 12;

// Monthly burn derived from obligations labeled "operating" or "payroll"
export function estimateMonthlyBurnUsd(snapshot: TreasurySnapshot): number {
  const monthly = snapshot.obligations
    .filter((o) => o.recurrence === "monthly")
    .reduce((sum, o) => sum + o.amountUsd, 0);
  const quarterly = snapshot.obligations
    .filter((o) => o.recurrence === "quarterly")
    .reduce((sum, o) => sum + o.amountUsd / 3, 0);
  const annual = snapshot.obligations
    .filter((o) => o.recurrence === "annual")
    .reduce((sum, o) => sum + o.amountUsd / 12, 0);
  return monthly + quarterly + annual || 1; // avoid division by zero
}

function obligations30dUsd(snapshot: TreasurySnapshot): number {
  const cutoff = new Date(snapshot.takenAt);
  cutoff.setDate(cutoff.getDate() + 30);
  return snapshot.obligations
    .filter((o) => new Date(o.dueDateIso) <= cutoff && !o.dueDateIso.startsWith("+"))
    .reduce((sum, o) => sum + o.amountUsd, 0);
}

function blendedApr(positions: TreasurySnapshot["positions"]): number {
  const total = positions.reduce((s, p) => s + p.amountUsd, 0);
  if (total === 0) return 0;
  return positions.reduce((s, p) => s + p.aprPct * p.amountUsd, 0) / total;
}

function topConcentration(
  positions: TreasurySnapshot["positions"],
  total: number
): { pct: number; protocol: string } {
  if (positions.length === 0 || total === 0) return { pct: 0, protocol: "—" };
  const max = positions.reduce(
    (best, p) => (p.amountUsd > best.amountUsd ? p : best),
    positions[0]
  );
  return { pct: (max.amountUsd / total) * 100, protocol: max.protocol };
}

function getParam<T>(rule: PolicyRule, key: string, fallback: T): T {
  return (rule.params[key] as T) ?? fallback;
}

function complianceScore(violations: PolicyViolation[]): number {
  const penalties = violations.reduce((sum, v) => sum + (v.severity === "block" ? 15 : 6), 0);
  return Math.max(0, 100 - penalties);
}

// ── Apply actions to snapshot (returns modified state for visualization) ───────

export function applyScenarioActions(
  snapshot: TreasurySnapshot,
  actions: ScenarioAction[]
): { liquidUsd: number; positions: TreasurySnapshot["positions"] } {
  let liquidUsd = snapshot.liquidUsd;
  const positions = snapshot.positions.map((p) => ({ ...p }));

  for (const action of actions) {
    const existing = positions.find((p) => p.adapterId === action.adapterId);
    if (action.kind === "deposit") {
      liquidUsd -= action.amountUsd;
      if (existing) {
        existing.amountUsd += action.amountUsd;
      } else {
        positions.push({
          adapterId: action.adapterId,
          protocol: action.meta?.protocol ?? action.adapterId,
          asset: "USDC",
          amountUsd: action.amountUsd,
          aprPct: action.meta?.aprPct ?? 0,
          accruedYieldUsd: 0,
          riskTier: action.meta?.riskTier ?? 1,
          unlockDays: action.meta?.unlockDays ?? 0,
        });
      }
    } else if (action.kind === "withdraw" && existing) {
      const withdrawn = Math.min(action.amountUsd, existing.amountUsd);
      existing.amountUsd -= withdrawn;
      liquidUsd += withdrawn;
    }
  }

  return { liquidUsd, positions: positions.filter((p) => p.amountUsd > 0) };
}

// ─────────────────────────────────────────────────────────────────────────────

export function projectRunway(
  snapshot: TreasurySnapshot,
  policy: Policy,
  monthlyBurnOverride?: number
): ProjectionResult {
  const monthlyBurn = monthlyBurnOverride ?? estimateMonthlyBurnUsd(snapshot);
  const deployed = snapshot.positions.reduce((s, p) => s + p.amountUsd, 0);
  const liquid = snapshot.liquidUsd;
  const total = snapshot.totalUsd;

  const apr = blendedApr(snapshot.positions);
  const yieldYear = deployed * (apr / 100);

  const { pct: topPct, protocol: topProtocol } = topConcentration(
    snapshot.positions,
    total
  );

  const protectedBuckets = snapshot.buckets.filter(
    (b) => b.kind === "emergency" || b.kind === "operating" || b.kind === "payroll" || b.kind === "tax"
  );
  const protectedUsd = protectedBuckets.reduce((s, b) => s + b.balanceUsd, 0);

  const liquidRunwayMonths = monthlyBurn > 0 ? liquid / monthlyBurn : 999;
  const protectedRunwayMonths = monthlyBurn > 0 ? protectedUsd / monthlyBurn : 999;

  const violations = evaluateViolations(snapshot, policy, {
    liquidRunwayMonths,
    protectedRunwayMonths,
    topConcentrationPct: topPct,
    deployedPct: total > 0 ? (deployed / total) * 100 : 0,
  });

  return {
    liquidRunwayMonths,
    protectedRunwayMonths,
    deployedCapitalUsd: deployed,
    deployedPct: total > 0 ? (deployed / total) * 100 : 0,
    blendedAprPct: apr,
    estimatedYieldYearUsd: yieldYear,
    topConcentrationPct: topPct,
    topConcentrationProtocol: topProtocol,
    complianceScore: complianceScore(violations),
    upcomingObligations30dUsd: obligations30dUsd(snapshot),
    violations,
  };
}

// Apply a list of scenario actions as a diff and reproject
export function projectScenario(
  snapshot: TreasurySnapshot,
  policy: Policy,
  actions: ScenarioAction[],
  monthlyBurnOverride?: number
): ProjectionResult {
  const { liquidUsd, positions } = applyScenarioActions(snapshot, actions);

  const modified: TreasurySnapshot = {
    ...snapshot,
    liquidUsd,
    totalUsd: snapshot.totalUsd,
    positions,
  };
  return projectRunway(modified, policy, monthlyBurnOverride);
}

// ─────────────────────────────────────────────────────────────────────────────

interface EvalContext {
  liquidRunwayMonths: number;
  protectedRunwayMonths: number;
  topConcentrationPct: number;
  deployedPct: number;
}

function evaluateViolations(
  snapshot: TreasurySnapshot,
  policy: Policy,
  ctx: EvalContext
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const rule of policy.rules) {
    if (!rule.enabled) continue;

    switch (rule.id) {
      case "MIN_RUNWAY_DAYS": {
        const minDays = getParam(rule, "days", 120);
        const minMonths = minDays / 30;
        if (ctx.protectedRunwayMonths < minMonths) {
          violations.push({
            ruleId: rule.id,
            severity: "block",
            message: `Protected runway ${ctx.protectedRunwayMonths.toFixed(1)} mo < ${minMonths.toFixed(1)} mo minimum`,
            actual: ctx.protectedRunwayMonths,
            limit: minMonths,
          });
        }
        break;
      }
      case "MAX_CONCENTRATION_PCT": {
        const maxPct = getParam(rule, "pct", 45);
        if (ctx.topConcentrationPct > maxPct) {
          violations.push({
            ruleId: rule.id,
            severity: "warn",
            message: `Top protocol concentration ${ctx.topConcentrationPct.toFixed(1)}% > ${maxPct}%`,
            actual: ctx.topConcentrationPct,
            limit: maxPct,
          });
        }
        break;
      }
      case "MIN_LIQUID_PCT": {
        const minLiqPct = getParam(rule, "pct", 50);
        const totalUsd = snapshot.totalUsd;
        const liquidPct = totalUsd > 0 ? (snapshot.liquidUsd / totalUsd) * 100 : 100;
        if (liquidPct < minLiqPct) {
          violations.push({
            ruleId: rule.id,
            severity: "warn",
            message: `Liquid ${liquidPct.toFixed(1)}% < ${minLiqPct}% minimum`,
            actual: liquidPct,
            limit: minLiqPct,
          });
        }
        break;
      }
      case "ALLOCATION_WHITELIST": {
        const whitelist = getParam<string[]>(rule, "adapters", []);
        if (whitelist.length > 0) {
          for (const pos of snapshot.positions) {
            if (!whitelist.includes(pos.adapterId)) {
              violations.push({
                ruleId: rule.id,
                severity: "block",
                message: `Adapter ${pos.adapterId} not in whitelist`,
                actual: 1,
                limit: 0,
              });
            }
          }
        }
        break;
      }
      case "YIELD_ONLY_EXCESS": {
        const emergencyBucket = snapshot.buckets.find((b) => b.kind === "emergency");
        const reserveOk = emergencyBucket
          ? emergencyBucket.balanceUsd >= emergencyBucket.targetUsd
          : true;
        if (!reserveOk && snapshot.positions.length > 0) {
          violations.push({
            ruleId: rule.id,
            severity: "warn",
            message: "Emergency reserve not fully funded but capital is deployed",
            actual: emergencyBucket?.balanceUsd ?? 0,
            limit: emergencyBucket?.targetUsd ?? 0,
          });
        }
        break;
      }
      case "REBALANCE_TRIGGER": {
        const thresholdPct = getParam(rule, "deviationPct", 10);
        for (const bucket of snapshot.buckets) {
          if (bucket.targetUsd === 0) continue;
          const deviationPct = Math.abs(bucket.balanceUsd - bucket.targetUsd) / bucket.targetUsd * 100;
          if (deviationPct > thresholdPct) {
            violations.push({
              ruleId: rule.id,
              severity: "warn",
              message: `Bucket ${bucket.kind} deviated ${deviationPct.toFixed(1)}% from target`,
              actual: deviationPct,
              limit: thresholdPct,
            });
          }
        }
        break;
      }
    }
  }

  return violations;
}
