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
    totalUsd: 812_440,
    liquidUsd: 492_440,
    positions: [
      {
        adapterId: "kamino-usdc-devnet",
        protocol: "Kamino Finance",
        asset: "USDC",
        amountUsd: 250_000,
        aprPct: 5.84,
        accruedYieldUsd: 1_247.18,
        riskTier: 1,
        unlockDays: 0,
      },
      {
        adapterId: "mock-rwa-usdy",
        protocol: "Ondo Finance (USDY)",
        asset: "USDY",
        amountUsd: 70_000,
        aprPct: 4.82,
        accruedYieldUsd: 289.34,
        riskTier: 2,
        unlockDays: 1,
      },
    ],
    buckets: [
      { kind: "operating", balanceUsd: 240_000, targetUsd: 240_000 },
      { kind: "payroll",   balanceUsd: 88_500,  targetUsd: 96_000  },
      { kind: "tax",       balanceUsd: 64_000,  targetUsd: 72_000  },
      { kind: "emergency", balanceUsd: 100_000, targetUsd: 100_000 },
      { kind: "yield",     balanceUsd: 319_940, targetUsd: 0       },
    ],
    obligations: [
      {
        id: "demo-ob-1",
        label: "Folha de Pagamento",
        amountUsd: 85_000,
        dueDateIso: new Date(now + 6 * 86_400_000).toISOString(),
        bucketKind: "payroll",
        recurrence: "monthly",
      },
      {
        id: "demo-ob-2",
        label: "Infra & SaaS (AWS + Vercel)",
        amountUsd: 18_500,
        dueDateIso: new Date(now + 14 * 86_400_000).toISOString(),
        bucketKind: "operating",
        recurrence: "monthly",
      },
      {
        id: "demo-ob-3",
        label: "Imposto de Renda Trimestral",
        amountUsd: 45_000,
        dueDateIso: new Date(now + 23 * 86_400_000).toISOString(),
        bucketKind: "tax",
        recurrence: "quarterly",
      },
      {
        id: "demo-ob-4",
        label: "Seguro Empresarial D&O",
        amountUsd: 20_000,
        dueDateIso: new Date(now + 28 * 86_400_000).toISOString(),
        bucketKind: "operating",
        recurrence: "once",
      },
      {
        id: "demo-ob-5",
        label: "Folha de Pagamento",
        amountUsd: 75_000,
        dueDateIso: new Date(now + 36 * 86_400_000).toISOString(),
        bucketKind: "payroll",
        recurrence: "monthly",
      },
      {
        id: "demo-ob-6",
        label: "Auditoria Contábil Anual",
        amountUsd: 8_000,
        dueDateIso: new Date(now + 55 * 86_400_000).toISOString(),
        bucketKind: "operating",
        recurrence: "annual",
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
    liquidRunwayMonths: 6.8,
    protectedRunwayMonths: 4.0,
    deployedCapitalUsd: 320_000,
    deployedPct: 39.4,
    blendedAprPct: 5.42,
    estimatedYieldYearUsd: 17_344,
    topConcentrationPct: 62,
    topConcentrationProtocol: "Kamino Finance",
    complianceScore: 94,
    upcomingObligations30dUsd: 168_500,
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
      message: "Folha de pagamento de $85.000 vence em 6 dias.",
    },
    {
      type: "concentration",
      severity: "warn",
      title: "Concentração em Kamino",
      message: "62% do capital alocado está em um único protocolo. Considere diversificar.",
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
