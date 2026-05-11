import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, intents, wallets, snapshots, policies, buckets, obligations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { parsePolicy, POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { isDemoUser, getDemoIntents, getDemoSnapshot, getDemoPolicy } from "@/lib/demo";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";
import { ExecutionClient } from "./ExecutionClient";

export const dynamic = "force-dynamic";

export default async function ExecutionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDemoUser(user.email)) {
    return (
      <ExecutionClient
        intents={getDemoIntents()}
        walletAddress={undefined}
        snapshot={getDemoSnapshot()}
        policy={getDemoPolicy()}
      />
    );
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const orgId = membership.orgId;

  const [orgIntents, walletRow, latestSnapshot, activePolicy, orgBuckets, orgObs] =
    await Promise.all([
      db.query.intents.findMany({
        where: eq(intents.orgId, orgId),
        orderBy: [desc(intents.createdAt)],
        limit: 50,
        with: { executions: true },
      }),
      db.query.wallets.findFirst({ where: eq(wallets.orgId, orgId) }),
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

  const intentRows = orgIntents.map((intent) => {
    const exec = intent.executions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    return {
      ...intent,
      txSignature: exec?.txSignature ?? null,
      onchainAt: exec?.onchainAt ?? null,
    };
  });

  // Build snapshot with real bucket balances
  let snapshot: TreasurySnapshot | null = null;
  if (latestSnapshot) {
    const totals = latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number };
    const rawBuckets = latestSnapshot.bucketsJson;
    const savedBuckets = Array.isArray(rawBuckets)
      ? (rawBuckets as { kind: string; balanceUsd: number }[])
      : [];
    const balanceByKind = new Map(savedBuckets.map((b) => [b.kind, b.balanceUsd]));
    snapshot = {
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
  }

  const policy: Policy | null = activePolicy
    ? parsePolicy({
        id: activePolicy.id,
        version: activePolicy.version,
        orgId: activePolicy.orgId,
        status: activePolicy.status,
        preset: activePolicy.preset,
        rules: activePolicy.jsonSpec,
        activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
      })
    : snapshot
    ? { ...POLICY_PRESETS.balanced, id: "fallback", version: 1, orgId, status: "active" as const, activatedAt: null }
    : null;

  return (
    <ExecutionClient
      intents={intentRows}
      walletAddress={walletRow?.address}
      snapshot={snapshot}
      policy={policy}
    />
  );
}
