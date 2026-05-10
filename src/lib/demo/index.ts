import type { TreasurySnapshot, Policy, ProjectionResult } from "@/lib/rules-engine/types";
import type { TreasuryAlert } from "@/lib/rules-engine/alerts";

export const DEMO_EMAIL = "dev@capivara.xyz";
export const DEMO_ORG_ID = "demo-capivara-ventures";
export const DEMO_ORG_NAME = "Capivara Ventures";

export function isDemoUser(email?: string | null): boolean {
  return email === DEMO_EMAIL;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function getDemoSnapshot(): TreasurySnapshot {
  const now = Date.now();
  return {
    id: "demo-snapshot-001",
    orgId: DEMO_ORG_ID,
    takenAt: new Date(now - 2 * 60_000).toISOString(),
    totalUsd: 847_200,
    liquidUsd: 312_400,
    positions: [
      {
        adapterId: "kamino-usdc-devnet",
        protocol: "Kamino Finance",
        asset: "USDC",
        amountUsd: 385_800,
        aprPct: 5.84,
        accruedYieldUsd: 1_847.22,
        riskTier: 1,
        unlockDays: 0,
      },
      {
        adapterId: "mock-rwa-usdy",
        protocol: "Ondo Finance (USDY)",
        asset: "USDY",
        amountUsd: 149_000,
        aprPct: 4.82,
        accruedYieldUsd: 624.18,
        riskTier: 2,
        unlockDays: 1,
      },
    ],
    buckets: [
      { kind: "operating", balanceUsd: 220_400, targetUsd: 255_000 },
      { kind: "payroll",   balanceUsd: 180_000, targetUsd: 170_000 },
      { kind: "tax",       balanceUsd: 75_200,  targetUsd: 85_000  },
      { kind: "emergency", balanceUsd: 200_000, targetUsd: 200_000 },
      { kind: "yield",     balanceUsd: 171_600, targetUsd: 150_000 },
    ],
    obligations: [
      {
        id: "demo-ob-1",
        label: "Folha de Pagamento",
        amountUsd: 75_000,
        dueDateIso: new Date(now + 6 * 86_400_000).toISOString(),
        bucketKind: "payroll",
        recurrence: "monthly",
      },
      {
        id: "demo-ob-2",
        label: "Imposto de Renda Trimestral",
        amountUsd: 45_000,
        dueDateIso: new Date(now + 23 * 86_400_000).toISOString(),
        bucketKind: "tax",
        recurrence: "quarterly",
      },
    ],
  };
}

// ── Policy ────────────────────────────────────────────────────────────────────

export function getDemoPolicy(): Policy {
  return {
    id: "demo-policy-001",
    version: 3,
    orgId: DEMO_ORG_ID,
    status: "active",
    preset: "balanced",
    rules: [
      { id: "MIN_RUNWAY_DAYS",       enabled: true,  params: { days: 90 } },
      { id: "MAX_CONCENTRATION_PCT", enabled: true,  params: { pct: 45 } },
      { id: "MIN_LIQUID_PCT",        enabled: true,  params: { pct: 50 } },
      { id: "ALLOCATION_WHITELIST",  enabled: true,  params: { adapters: ["kamino-usdc-devnet", "mock-rwa-usdy"] } },
      { id: "YIELD_ONLY_EXCESS",     enabled: true,  params: {} },
      { id: "REBALANCE_TRIGGER",     enabled: true,  params: { deviationPct: 10 } },
      { id: "BUCKET_TARGET",         enabled: true,  params: {} },
    ],
    activatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  };
}

// ── Projection ────────────────────────────────────────────────────────────────

export function getDemoProjection(): ProjectionResult {
  return {
    liquidRunwayMonths: 9.8,
    protectedRunwayMonths: 12.4,
    deployedCapitalUsd: 534_800,
    deployedPct: 63.1,
    blendedAprPct: 5.44,
    estimatedYieldYearUsd: 29_092,
    topConcentrationPct: 45.5,
    topConcentrationProtocol: "Kamino Finance",
    complianceScore: 94,
    upcomingObligations30dUsd: 120_000,
    violations: [],
  };
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function getDemoAlerts(): TreasuryAlert[] {
  return [
    {
      type: "obligation",
      severity: "warn",
      title: "Obrigação próxima",
      message: "Folha de pagamento de $75.000 vence em 6 dias.",
    },
  ];
}

// ── Convenience: tudo junto para o dashboard ──────────────────────────────────

export function getDemoDashboardData() {
  const snap = getDemoSnapshot();
  const projection = getDemoProjection();
  const alerts = getDemoAlerts();
  return {
    snap,
    projection,
    alerts,
    totals: { totalUsd: snap.totalUsd, liquidUsd: snap.liquidUsd },
    positions: snap.positions,
    snapshotAge: 2,
    orgName: DEMO_ORG_NAME,
  };
}
