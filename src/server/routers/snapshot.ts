import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { snapshots, wallets } from "@/lib/db/schema";
import { fetchWalletBalances } from "@/lib/solana/indexer";
import { kaminoAdapter } from "@/lib/adapters/kamino";
import { mockRwaAdapter } from "@/lib/adapters/mock-rwa";
import { projectRunway } from "@/lib/rules-engine/projections";
import { parsePolicy } from "@/lib/rules-engine/policy";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { policies, buckets, obligations } from "@/lib/db/schema";
import { and } from "drizzle-orm";
import type { TreasurySnapshot } from "@/lib/rules-engine/types";
import { getDemoSnapshot, getDemoProjection } from "@/lib/demo";

export const snapshotRouter = router({
  // Latest snapshot for the org
  latest: orgProcedure.query(async ({ ctx }) => {
    if (ctx.isDemoUser) {
      const s = getDemoSnapshot();
      return { id: s.id, orgId: s.orgId, takenAt: new Date(s.takenAt), totalsJson: { totalUsd: s.totalUsd, liquidUsd: s.liquidUsd }, positionsJson: s.positions, bucketsJson: {} };
    }
    return ctx.db.query.snapshots.findFirst({
      where: eq(snapshots.orgId, ctx.orgId),
      orderBy: [desc(snapshots.takenAt)],
    }) ?? null;
  }),

  // Paginated history
  list: orgProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.snapshots.findMany({
        where: eq(snapshots.orgId, ctx.orgId),
        orderBy: [desc(snapshots.takenAt)],
        limit: input.limit,
      });
    }),

  // Compute projection from latest snapshot + active policy
  projection: orgProcedure.query(async ({ ctx }) => {
    if (ctx.isDemoUser) return getDemoProjection();
    const [latestSnapshot, activePolicy, orgBuckets, orgObs] = await Promise.all([
      ctx.db.query.snapshots.findFirst({
        where: eq(snapshots.orgId, ctx.orgId),
        orderBy: [desc(snapshots.takenAt)],
      }),
      ctx.db.query.policies.findFirst({
        where: and(eq(policies.orgId, ctx.orgId), eq(policies.status, "active")),
      }),
      ctx.db.query.buckets.findMany({ where: eq(buckets.orgId, ctx.orgId) }),
      ctx.db.query.obligations.findMany({ where: eq(obligations.orgId, ctx.orgId) }),
    ]);

    if (!latestSnapshot) return null;

    const policy = activePolicy
      ? parsePolicy({
          id: activePolicy.id,
          version: activePolicy.version,
          orgId: activePolicy.orgId,
          status: activePolicy.status,
          preset: activePolicy.preset,
          rules: activePolicy.jsonSpec,
          activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
        })
      : parsePolicy({
          id: "fallback",
          version: 1,
          orgId: ctx.orgId,
          status: "active",
          preset: "balanced",
          rules: POLICY_PRESETS.balanced.rules,
          activatedAt: new Date().toISOString(),
        });

    const totals = latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number };
    const snap: TreasurySnapshot = {
      id: latestSnapshot.id,
      orgId: ctx.orgId,
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

    return projectRunway(snap, policy);
  }),

  // Manually trigger a fresh snapshot — reads from Helius + adapters
  takeManual: orgProcedure.mutation(async ({ ctx }) => {
    if (ctx.isDemoUser) {
      const s = getDemoSnapshot();
      return { snapshot: s, totalUsd: s.totalUsd, liquidUsd: s.liquidUsd, positions: s.positions };
    }

    // Find primary wallet
    const wallet = await ctx.db.query.wallets.findFirst({
      where: and(eq(wallets.orgId, ctx.orgId), eq(wallets.isPrimary, true)),
    });

    if (!wallet) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Nenhuma wallet principal configurada. Conecte sua wallet primeiro.",
      });
    }

    // Fetch USDC balance from Helius
    const balances = await fetchWalletBalances(wallet.address);

    // Read adapter positions (best-effort — fail gracefully on devnet issues)
    const { PublicKey } = await import("@solana/web3.js");
    const pubkey = new PublicKey(wallet.address);
    const [kaminoPos, mockRwaPos] = await Promise.allSettled([
      kaminoAdapter.readPosition(pubkey),
      mockRwaAdapter.readPosition(pubkey),
    ]);

    const positions: TreasurySnapshot["positions"] = [];

    if (kaminoPos.status === "fulfilled" && kaminoPos.value.amountUsd > 0) {
      positions.push({
        adapterId: "kamino-usdc-devnet",
        protocol: "Kamino",
        asset: "USDC",
        amountUsd: kaminoPos.value.amountUsd,
        aprPct: 5.84,
        accruedYieldUsd: kaminoPos.value.accruedYieldUsd,
        riskTier: 1,
        unlockDays: 0,
      });
    }

    if (mockRwaPos.status === "fulfilled" && mockRwaPos.value.amountUsd > 0) {
      positions.push({
        adapterId: "mock-rwa-usdy",
        protocol: "Mock RWA (USDY-like)",
        asset: "USDY",
        amountUsd: mockRwaPos.value.amountUsd,
        aprPct: 4.82,
        accruedYieldUsd: mockRwaPos.value.accruedYieldUsd,
        riskTier: 2,
        unlockDays: 1,
      });
    }

    const deployedUsd = positions.reduce((s, p) => s + p.amountUsd, 0);
    const totalUsd = balances.stablecoinBalance + deployedUsd;
    const liquidUsd = balances.stablecoinBalance;

    const [snapshot] = await ctx.db
      .insert(snapshots)
      .values({
        orgId: ctx.orgId,
        totalsJson: { totalUsd, liquidUsd, solLamports: balances.solLamports.toString() } as unknown as Record<string, unknown>,
        positionsJson: positions as unknown as Record<string, unknown>[],
        bucketsJson: {} as unknown as Record<string, unknown>,
      })
      .returning();

    return { snapshot, totalUsd, liquidUsd, positions };
  }),
});
