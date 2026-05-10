import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, buckets, obligations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { projectRunway } from "@/lib/rules-engine/projections";
import { parsePolicy } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { BucketCard } from "@/components/dashboard/BucketCard";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { SnapshotButton } from "@/components/dashboard/SnapshotButton";
import { AlertsBanner } from "@/components/AlertsBanner";
import { RunwayBar } from "@/components/dashboard/RunwayBar";
import { ConcentrationPanel } from "@/components/dashboard/ConcentrationPanel";
import { ObligationsPanel } from "@/components/dashboard/ObligationsPanel";
import { computeAlerts } from "@/lib/rules-engine/alerts";
import { isDemoUser, getDemoDashboardData } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDemoUser(user.email)) {
    return <DemoDashboard />;
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });

  if (!membership) {
    return <OnboardingPrompt />;
  }

  const orgId = membership.orgId;

  const [latestSnapshot, activePolicy, orgBuckets, orgObligations] = await Promise.all([
    db.query.snapshots.findFirst({
      where: eq(snapshots.orgId, orgId),
      orderBy: [desc(snapshots.takenAt)],
    }),
    db.query.policies.findFirst({
      where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
    }),
    db.query.buckets.findMany({ where: eq(buckets.orgId, orgId) }),
    db.query.obligations.findMany({ where: eq(obligations.orgId, orgId) }),
  ]);

  let snap: TreasurySnapshot | null = null;
  let projection = null;
  let alerts: import("@/lib/rules-engine/alerts").TreasuryAlert[] = [];

  if (latestSnapshot && activePolicy) {
    snap = buildSnapshot(orgId, latestSnapshot, orgBuckets, orgObligations);
    const policy = buildPolicy(activePolicy);
    projection = projectRunway(snap, policy);
    alerts = computeAlerts(snap, policy);
  }

  const totals = latestSnapshot
    ? (latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number })
    : null;

  const positions = snap?.positions ?? [];
  const snapshotAge = latestSnapshot
    ? Math.floor((Date.now() - latestSnapshot.takenAt.getTime()) / 60_000)
    : null;

  const bucketRows = orgBuckets.map((b, i) => ({
    id: b.id ?? `b-${i}`,
    kind: b.kind,
    label: BUCKET_LABELS[b.kind] ?? b.kind,
    targetAmountCents: b.targetAmountCents,
    currency: b.currency,
    balanceUsd: 0,
  }));

  const concentrationLimit = activePolicy
    ? (() => {
        const rule = (activePolicy.jsonSpec as unknown as { id: string; params: Record<string, unknown> }[])
          ?.find((r) => r.id === "MAX_CONCENTRATION_PCT");
        return rule ? Number(rule.params.pct ?? 45) : null;
      })()
    : null;

  const obligationRows = orgObligations.map((o) => ({
    id: o.id,
    label: o.label,
    amountCents: o.amountCents,
    dueDate: o.dueDate.toISOString(),
    recurrence: o.recurrence,
  }));

  return (
    <DashboardLayout
      orgName={membership.org.name}
      snapshotAge={snapshotAge}
      alerts={alerts}
      totalUsd={totals?.totalUsd ?? null}
      liquidUsd={totals?.liquidUsd ?? null}
      projection={projection}
      policyVersion={activePolicy?.version ?? null}
      concentrationLimit={concentrationLimit}
      buckets={bucketRows}
      obligations={obligationRows}
      positions={positions}
      snapBuckets={snap?.buckets}
    />
  );
}

// ── Shared layout (real + demo) ───────────────────────────────────────────────

function DashboardLayout({
  orgName,
  snapshotAge,
  alerts,
  totalUsd,
  liquidUsd,
  projection,
  policyVersion,
  concentrationLimit,
  buckets: bucketRows,
  obligations: obligationRows,
  positions,
  snapBuckets,
  isDemo,
}: {
  orgName: string;
  snapshotAge: number | null;
  alerts: import("@/lib/rules-engine/alerts").TreasuryAlert[];
  totalUsd: number | null;
  liquidUsd: number | null;
  projection: import("@/lib/rules-engine/types").ProjectionResult | null;
  policyVersion: number | null;
  concentrationLimit?: number | null;
  buckets: { id: string; kind: string; label: string; targetAmountCents: number; currency: string; balanceUsd: number }[];
  obligations: { id: string; label: string; amountCents: number; dueDate: string; recurrence: string }[];
  positions: TreasurySnapshot["positions"];
  snapBuckets?: TreasurySnapshot["buckets"];
  isDemo?: boolean;
}) {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <div className="text-[10px] text-fg-3 font-mono tracking-wider uppercase mb-0.5">
            Workspace / Dashboard
          </div>
          <h1 className="text-lg font-semibold text-fg">
            Cockpit · <span className="text-fg-3 font-normal">{orgName}</span>
          </h1>
          <p className="text-xs text-fg-3 mt-0.5">
            Snapshot atualizado a cada 5 min via Helius webhooks.
            {policyVersion ? ` Política Balanced v${policyVersion} ativa.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {snapshotAge !== null && (
            <span className="text-[10px] text-fg-3 font-mono">
              snapshot há {snapshotAge === 0 ? "<1" : snapshotAge}min
            </span>
          )}
          <SnapshotButton />
        </div>
      </div>

      {/* Alerts */}
      <AlertsBanner alerts={alerts} />

      {/* 8-card KPI grid */}
      <div className="mb-5">
        <KpiGrid
          totalUsd={totalUsd}
          liquidUsd={liquidUsd}
          projection={projection}
          policyVersion={policyVersion}
        />
      </div>

      {/* Runway bar */}
      {totalUsd !== null && liquidUsd !== null && (
        <div className="rounded-xl border border-line bg-bg-1 p-4 mb-5">
          <RunwayBar
            liquidUsd={liquidUsd}
            deployedUsd={projection?.deployedCapitalUsd ?? 0}
            totalUsd={totalUsd}
            buckets={snapBuckets}
          />
        </div>
      )}

      {/* No snapshot yet */}
      {totalUsd === null && (
        <div className="rounded-xl border border-line bg-bg-1 p-8 text-center text-fg-3 text-sm mb-5">
          <p className="font-mono text-xs tracking-wider uppercase mb-2">Aguardando snapshot</p>
          <p className="mb-4">Conecte sua wallet e clique em Snapshot para carregar os dados.</p>
        </div>
      )}

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Left: buckets + positions */}
        <div className="lg:col-span-2 space-y-5">
          {bucketRows.length > 0 && (
            <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
                Buckets de Alocação
              </div>
              <div className="divide-y divide-line">
                {bucketRows.map((b) => (
                  <BucketCard key={b.id} bucket={b} balanceUsd={b.balanceUsd} />
                ))}
              </div>
            </div>
          )}

          {positions.length > 0 && (
            <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
                Posições Alocadas
              </div>
              <PositionsTable positions={positions} />
            </div>
          )}
        </div>

        {/* Right: concentration + obligations */}
        <div className="space-y-5">
          {totalUsd !== null && liquidUsd !== null && (
            <ConcentrationPanel
              totalUsd={totalUsd}
              liquidUsd={liquidUsd}
              positions={positions}
              complianceScore={projection?.complianceScore ?? 0}
              policyVersion={policyVersion}
              concentrationLimit={concentrationLimit}
            />
          )}

          <ObligationsPanel
            obligations={obligationRows}
            isDemo={isDemo}
          />
        </div>
      </div>
    </div>
  );
}

// ── Demo dashboard ────────────────────────────────────────────────────────────

function DemoDashboard() {
  const { snap, projection, alerts, totals, positions, snapshotAge, orgName } = getDemoDashboardData();

  const demoBuckets = snap.buckets.map((b, i) => ({
    id: `demo-b-${i}`,
    kind: b.kind,
    label: BUCKET_LABELS[b.kind] ?? b.kind,
    targetAmountCents: b.targetUsd * 100,
    currency: "USD",
    balanceUsd: b.balanceUsd,
  }));

  const demoObligations = snap.obligations.map((o) => ({
    id: o.id,
    label: o.label,
    amountCents: o.amountUsd * 100,
    dueDate: o.dueDateIso,
    recurrence: o.recurrence,
  }));

  return (
    <DashboardLayout
      orgName={orgName}
      snapshotAge={snapshotAge}
      alerts={alerts}
      totalUsd={totals.totalUsd}
      liquidUsd={totals.liquidUsd}
      projection={projection}
      policyVersion={3}
      concentrationLimit={45}
      buckets={demoBuckets}
      obligations={demoObligations}
      positions={positions}
      snapBuckets={snap.buckets}
      isDemo
    />
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  operating: "Operacional",
  payroll: "Folha",
  tax: "Impostos",
  emergency: "Reserva",
  yield: "Excedente",
  custom: "Outros",
};

function OnboardingPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-sm text-fg-2 mb-4">Você ainda não tem uma organização.</div>
        <a href="/setup" className="text-sm text-accent hover:underline">
          Iniciar onboarding →
        </a>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSnapshot(
  orgId: string,
  row: typeof snapshots.$inferSelect,
  orgBuckets: (typeof buckets.$inferSelect)[],
  orgObs: (typeof obligations.$inferSelect)[]
): TreasurySnapshot {
  const totals = row.totalsJson as { totalUsd: number; liquidUsd: number };
  const positions = (row.positionsJson as unknown[]) as TreasurySnapshot["positions"];
  return {
    id: row.id,
    orgId,
    takenAt: row.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions,
    buckets: orgBuckets.map((b) => ({
      kind: b.kind as TreasurySnapshot["buckets"][number]["kind"],
      balanceUsd: 0,
      targetUsd: b.targetAmountCents / 100,
    })),
    obligations: orgObs.map((o) => ({
      id: o.id,
      label: o.label,
      amountUsd: o.amountCents / 100,
      dueDateIso: o.dueDate.toISOString(),
      bucketKind: "operating" as const,
      recurrence: o.recurrence as TreasurySnapshot["obligations"][number]["recurrence"],
    })),
  };
}

function buildPolicy(row: typeof policies.$inferSelect): Policy {
  return parsePolicy({
    id: row.id,
    version: row.version,
    orgId: row.orgId,
    status: row.status,
    preset: row.preset,
    rules: row.jsonSpec,
    activatedAt: row.activatedAt?.toISOString() ?? null,
  });
}
