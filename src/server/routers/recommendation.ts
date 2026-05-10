import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { recommendations, intents } from "@/lib/db/schema";

export const recommendationRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.recommendations.findMany({
      where: eq(recommendations.orgId, ctx.orgId),
      orderBy: [desc(recommendations.createdAt)],
      limit: 20,
    });
  }),

  save: orgProcedure
    .input(
      z.object({
        policyVersion: z.number().int().positive(),
        rationale: z.string().min(1).max(1000),
        actions: z.array(
          z.object({
            kind: z.enum(["deposit", "withdraw", "rebalance"]),
            adapterId: z.string(),
            amountUsd: z.number().positive(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rec] = await ctx.db
        .insert(recommendations)
        .values({
          orgId: ctx.orgId,
          policyVersion: input.policyVersion,
          rationale: input.rationale,
          actionsJson: input.actions as unknown as Record<string, unknown>[],
          status: "pending",
        })
        .returning();
      return rec;
    }),

  approve: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rec = await ctx.db.query.recommendations.findFirst({
        where: and(
          eq(recommendations.id, input.id),
          eq(recommendations.orgId, ctx.orgId)
        ),
      });
      if (!rec) throw new TRPCError({ code: "NOT_FOUND" });

      // Create draft intents for each action
      const actions = rec.actionsJson as {
        kind: "deposit" | "withdraw" | "rebalance";
        adapterId: string;
        amountUsd: number;
      }[];

      await Promise.all(
        actions.map((a, i) =>
          ctx.db.insert(intents).values({
            orgId: ctx.orgId,
            recommendationId: rec.id,
            kind: a.kind,
            paramsJson: { adapterId: a.adapterId, amountUsd: a.amountUsd } as unknown as Record<string, unknown>,
            status: "draft",
            idempotencyKey: `${rec.id}-action-${i}`,
          })
        )
      );

      const [updated] = await ctx.db
        .update(recommendations)
        .set({ status: "approved" })
        .where(eq(recommendations.id, input.id))
        .returning();
      return updated;
    }),

  dismiss: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(recommendations)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(recommendations.id, input.id),
            eq(recommendations.orgId, ctx.orgId)
          )
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});
