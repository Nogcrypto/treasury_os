import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, orgProcedure } from "../trpc";
import { equityTokens, equityDividends } from "@/lib/db/schema";
import { getDemoProjection, getDemoSnapshot } from "@/lib/demo";

const DEMO_EQUITY_TOKEN = {
  id: "demo-equity-token",
  orgId: "demo-capivara-ventures",
  mint: "CAPi4rMzxSw9rBBd1TWGCqRGMpYU9ZQCX7VQPmXUqgN",
  symbol: "CAPI",
  name: "Capivara Ventures Token",
  decimals: 6,
  totalSupply: 10_000_000_000_000,    // raw units: 10M × 1e6
  priceUsdcE6: 82_000,               // $0.082
  poolAddress: "CAPiPooL9xK3y8WzTkLrJEPLHb2DRaXtaAB47V3M111",
  poolAprBps: 1840,
  totalDividendsCents: 2_450_000,
  createdAt: new Date("2026-01-15"),
};

const DEMO_DIVIDENDS = [
  { id: "dd1", orgId: "demo", tokenMint: DEMO_EQUITY_TOKEN.mint, amountCents: 820_000, perTokenUsdc: "0.00044", recipientsCount: 312, txSignature: "5xNpQ2WvK9mT", status: "confirmed", distributedAt: new Date("2026-04-15"), createdAt: new Date("2026-04-15") },
  { id: "dd2", orgId: "demo", tokenMint: DEMO_EQUITY_TOKEN.mint, amountCents: 950_000, perTokenUsdc: "0.00051", recipientsCount: 298, txSignature: "3kLmR7YcN4pX", status: "confirmed", distributedAt: new Date("2026-01-15"), createdAt: new Date("2026-01-15") },
];

export const equityRouter = router({
  getToken: orgProcedure.query(async ({ ctx }) => {
    if (ctx.isDemoUser) return DEMO_EQUITY_TOKEN;
    return ctx.db.query.equityTokens.findFirst({
      where: eq(equityTokens.orgId, ctx.orgId),
    }) ?? null;
  }),

  configureToken: orgProcedure
    .input(z.object({
      mint:        z.string().min(32).max(44),
      symbol:      z.string().min(1).max(12).toUpperCase(),
      name:        z.string().min(1).max(64),
      decimals:    z.number().int().min(0).max(9).default(6),
      totalSupply: z.number().positive().optional(),
      priceUsdcE6: z.number().int().positive().optional(),
      poolAddress: z.string().min(32).max(44).optional(),
      poolAprBps:  z.number().int().min(0).max(100_000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoUser) return { ok: true };
      const existing = await ctx.db.query.equityTokens.findFirst({
        where: eq(equityTokens.orgId, ctx.orgId),
      });
      if (existing) {
        await ctx.db.update(equityTokens)
          .set({ ...input })
          .where(eq(equityTokens.orgId, ctx.orgId));
      } else {
        await ctx.db.insert(equityTokens).values({
          orgId: ctx.orgId,
          ...input,
          totalDividendsCents: 0,
        });
      }
      return { ok: true };
    }),

  getDividends: orgProcedure.query(async ({ ctx }) => {
    if (ctx.isDemoUser) return DEMO_DIVIDENDS;
    return ctx.db.query.equityDividends.findMany({
      where: eq(equityDividends.orgId, ctx.orgId),
      orderBy: [desc(equityDividends.createdAt)],
    });
  }),

  recordDividend: orgProcedure
    .input(z.object({
      tokenMint:       z.string(),
      amountCents:     z.number().int().positive(),
      perTokenUsdc:    z.string().optional(),
      recipientsCount: z.number().int().optional(),
      txSignature:     z.string().optional(),
      status:          z.enum(["pending", "confirmed", "failed"]).default("pending"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoUser) return { ok: true, id: "demo" };
      const [row] = await ctx.db.insert(equityDividends).values({
        orgId: ctx.orgId,
        ...input,
        distributedAt: input.status === "confirmed" ? new Date() : undefined,
      }).returning({ id: equityDividends.id });
      // Update total dividends on token
      const existing = await ctx.db.query.equityDividends.findMany({
        where: eq(equityDividends.orgId, ctx.orgId),
      });
      const total = existing.reduce((s, d) => s + (d.amountCents ?? 0), input.amountCents);
      await ctx.db.update(equityTokens)
        .set({ totalDividendsCents: total })
        .where(eq(equityTokens.orgId, ctx.orgId));
      return { ok: true, id: row.id };
    }),

  confirmDividend: orgProcedure
    .input(z.object({ id: z.string(), txSignature: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoUser) return { ok: true };
      await ctx.db.update(equityDividends)
        .set({ status: "confirmed", txSignature: input.txSignature, distributedAt: new Date() })
        .where(eq(equityDividends.id, input.id));
      return { ok: true };
    }),

  updatePool: orgProcedure
    .input(z.object({
      poolAddress: z.string().min(32).max(44),
      poolAprBps:  z.number().int().min(0).max(100_000),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isDemoUser) return { ok: true };
      await ctx.db.update(equityTokens)
        .set(input)
        .where(eq(equityTokens.orgId, ctx.orgId));
      return { ok: true };
    }),
});
