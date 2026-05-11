import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, obligations, buckets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parsePolicy, POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { Simulator } from "@/components/Simulator";
import { isDemoUser, getDemoSnapshot, getDemoPolicy } from "@/lib/demo";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDemoUser(user.email)) {
    return (
      <Simulator
        snapshot={getDemoSnapshot()}
        policy={getDemoPolicy()}
        policyVersion={3}
      />
    );
  }

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
    const t = await getTranslations("simulator");
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-[9px] font-mono text-fg-3 uppercase tracking-wider mb-3">{t("breadcrumb" as never)}</div>
          <h1 className="text-base font-semibold text-fg mb-2">{t("no_snapshot_title" as never)}</h1>
          <p className="text-xs text-fg-3">
            {t("no_snapshot_desc" as never)}
          </p>
        </div>
      </div>
    );
  }

  const totals = latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number };

  // Read saved bucket allocations; fall back gracefully for old snapshots
  const rawBuckets = latestSnapshot.bucketsJson;
  const savedBuckets = Array.isArray(rawBuckets)
    ? (rawBuckets as { kind: string; balanceUsd: number }[])
    : [];
  const balanceByKind = new Map(savedBuckets.map((b) => [b.kind, b.balanceUsd]));

  const snapshot: TreasurySnapshot = {
    id: latestSnapshot.id,
    orgId,
    takenAt: latestSnapshot.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions: (latestSnapshot.positionsJson as unknown[]) as TreasurySnapshot["positions"],
    buckets: orgBuckets.map((b) => ({
      kind: b.kind as TreasurySnapshot["buckets"][number]["kind"],
      balanceUsd: balanceByKind.get(b.kind) ?? 0,
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
    <Simulator
      snapshot={snapshot}
      policy={policy}
      policyVersion={activePolicy?.version ?? 1}
    />
  );
}
