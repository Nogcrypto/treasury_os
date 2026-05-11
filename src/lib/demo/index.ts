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

export function getDemoAlerts(locale?: string): TreasuryAlert[] {
  const isPt = locale === "pt";
  return [
    {
      type: "obligation",
      severity: "warn",
      title: "obligation",
      message: isPt
        ? '"Folha de Pagamento" de $85.000 vence em 6 dias.'
        : '"Payroll" of $85,000 due in 6 days.',
    },
    {
      type: "concentration",
      severity: "warn",
      title: "concentration",
      message: isPt
        ? "62% do capital alocado está em um único protocolo. Considere diversificar."
        : "62% of deployed capital is in a single protocol. Consider diversifying.",
    },
  ];
}

// ── Demo intents (Execução page) ──────────────────────────────────────────────

export function getDemoIntents() {
  const now = Date.now();
  return [
    {
      id: "01HXC9F0000000000001",
      kind: "deposit" as const,
      status: "confirmed" as const,
      paramsJson: { adapterId: "kamino-usdc-devnet", amountUsd: 250_000 },
      idempotencyKey: "demo-deposit-kamino-250k",
      createdAt: new Date(now - 3 * 86_400_000),
      updatedAt: new Date(now - 3 * 86_400_000 + 45_000),
      txSignature: "5xNpQ2WvK9mT8pLzR6QsYjKbVN3cXhF7aDE4uCwMtPy",
      onchainAt: new Date(now - 3 * 86_400_000 + 45_000),
    },
    {
      id: "01HXC8A0000000000002",
      kind: "deposit" as const,
      status: "confirmed" as const,
      paramsJson: { adapterId: "mock-rwa-usdy", amountUsd: 70_000 },
      idempotencyKey: "demo-deposit-rwa-70k",
      createdAt: new Date(now - 5 * 86_400_000),
      updatedAt: new Date(now - 5 * 86_400_000 + 60_000),
      txSignature: "3kLmR7YcN4pXwQvH2sT5jFnDgBuZ8eAW6rCyMoKiPbV",
      onchainAt: new Date(now - 5 * 86_400_000 + 60_000),
    },
    {
      id: "01HW0K20000000000003",
      kind: "withdraw" as const,
      status: "confirmed" as const,
      paramsJson: { adapterId: "kamino-usdc-devnet", amountUsd: 18_500 },
      idempotencyKey: "demo-withdraw-kamino-18500",
      createdAt: new Date(now - 12 * 86_400_000),
      updatedAt: new Date(now - 12 * 86_400_000 + 30_000),
      txSignature: "7pKwR5YsM3nXvQtH9sT2jGmDhCuZ6eAW4rCxNoKiPaV",
      onchainAt: new Date(now - 12 * 86_400_000 + 30_000),
    },
    {
      id: "01HV9Z10000000000004",
      kind: "rebalance" as const,
      status: "confirmed" as const,
      paramsJson: { adapterId: "kamino-usdc-devnet", amountUsd: 12_000 },
      idempotencyKey: "demo-rebalance-12k",
      createdAt: new Date(now - 18 * 86_400_000),
      updatedAt: new Date(now - 18 * 86_400_000 + 25_000),
      txSignature: "9qMnT6ZcP4rYwRvI3sU8kHoEiBuX7fBW5sCyLpKjQdW",
      onchainAt: new Date(now - 18 * 86_400_000 + 25_000),
    },
  ];
}

// ── Policy versions (audit log) ───────────────────────────────────────────────

export function getDemoPolicyVersions(): Array<{
  id: string;
  version: number;
  status: "draft" | "active" | "archived";
  preset: string;
  activatedAt: string;
  authorLabel: string;
}> {
  const now = Date.now();
  return [
    {
      id: "demo-policy-v3",
      version: 3,
      status: "active",
      preset: "balanced",
      activatedAt: new Date(now - 2 * 3600_000).toISOString(),
      authorLabel: "Copilot · você aprovou",
    },
    {
      id: "demo-policy-v2",
      version: 2,
      status: "archived",
      preset: "conservative",
      activatedAt: new Date(now - 13 * 86_400_000).toISOString(),
      authorLabel: "Founder · manual edit",
    },
    {
      id: "demo-policy-v1",
      version: 1,
      status: "archived",
      preset: "conservative",
      activatedAt: new Date(now - 25 * 86_400_000).toISOString(),
      authorLabel: "Wizard · seed",
    },
  ];
}

// ── Convenience: tudo junto para o dashboard ──────────────────────────────────

export function getDemoDashboardData(locale?: string) {
  const snap = getDemoSnapshot();
  const projection = getDemoProjection();
  const alerts = getDemoAlerts(locale);
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
