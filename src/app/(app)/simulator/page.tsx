import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, obligations, buckets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { parsePolicy } from "@/lib/rules-engine/policy";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { Simulator } from "@/components/Simulator";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const orgId = membership.orgId;

  const [latestSnapshot, activePolicy, orgBuckets, orgObs] = await Promise.all([
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

  if (!latestSnapshot) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
            Tesouraria / Simulador
          </div>
          <h1 className="text-xl font-semibold text-fg">Simulador</h1>
        </div>
        <div className="rounded-xl border border-line bg-bg-1 p-8 text-center text-fg-3 text-sm">
          <p className="font-mono text-xs tracking-wider uppercase mb-2">Sem dados</p>
          <p>Tire um snapshot no dashboard antes de simular cenários.</p>
        </div>
      </div>
    );
  }

  const totals = latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number };
  const snapshot: TreasurySnapshot = {
    id: latestSnapshot.id,
    orgId,
    takenAt: latestSnapshot.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions: (latestSnapshot.positionsJson as unknown[]) as TreasurySnapshot["positions"],
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

  const policy: Policy = activePolicy
    ? parsePolicy({
        id: activePolicy.id,
        version: activePolicy.version,
        orgId: activePolicy.orgId,
        status: activePolicy.status,
        preset: activePolicy.preset,
        rules: activePolicy.jsonSpec,
        activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
      })
    : { ...POLICY_PRESETS.balanced, id: "fallback", version: 1, orgId, status: "active", activatedAt: null };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
          Tesouraria / Simulador
        </div>
        <h1 className="text-xl font-semibold text-fg">Simulador de cenários</h1>
        <p className="text-sm text-fg-3 mt-1">
          Simule movimentos de capital e veja o impacto no runway, APR e compliance.
        </p>
      </div>
      <Simulator
        snapshot={snapshot}
        policy={policy}
        policyVersion={activePolicy?.version ?? 1}
      />
    </div>
  );
}
