import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, obligations, buckets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { streamCopilotTurn } from "@/lib/agent/client";
import type { CopilotMessage } from "@/lib/agent/client";
import { parsePolicy } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";
import { isDemoUser, getDemoSnapshot, getDemoPolicy } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { message, history } = (await req.json()) as {
    message: string;
    history: CopilotMessage[];
  };

  if (!message?.trim()) return new Response("Empty message", { status: 400 });

  let snapshot: TreasurySnapshot;
  let policy: Policy | null;
  let orgId: string;

  if (isDemoUser(user.email)) {
    snapshot = getDemoSnapshot();
    policy = getDemoPolicy();
    orgId = snapshot.orgId;
  } else {
    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.userId, user.id),
    });
    if (!membership) return new Response("No org", { status: 400 });

    orgId = membership.orgId;

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

    snapshot = latestSnapshot
      ? buildSnapshot(orgId, latestSnapshot, orgBuckets, orgObs)
      : emptySnapshot(orgId);

    policy = activePolicy
      ? parsePolicy({
          id: activePolicy.id,
          version: activePolicy.version,
          orgId: activePolicy.orgId,
          status: activePolicy.status,
          preset: activePolicy.preset,
          rules: activePolicy.jsonSpec,
          activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
        })
      : null;
  }

  const ctx = {
    orgId,
    snapshot,
    policy,
    recentSnapshots: [snapshot],
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamCopilotTurn(ctx, history, message)) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(`\n\n[Erro interno: ${String(err)}]`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySnapshot(orgId: string): TreasurySnapshot {
  return {
    id: "empty",
    orgId,
    takenAt: new Date().toISOString(),
    totalUsd: 0,
    liquidUsd: 0,
    positions: [],
    buckets: [],
    obligations: [],
  };
}

function buildSnapshot(
  orgId: string,
  row: typeof snapshots.$inferSelect,
  orgBuckets: (typeof buckets.$inferSelect)[],
  orgObs: (typeof obligations.$inferSelect)[]
): TreasurySnapshot {
  const totals = row.totalsJson as { totalUsd: number; liquidUsd: number };
  return {
    id: row.id,
    orgId,
    takenAt: row.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions: (row.positionsJson as unknown[]) as TreasurySnapshot["positions"],
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
