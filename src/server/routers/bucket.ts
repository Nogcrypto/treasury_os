import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { buckets } from "@/lib/db/schema";

const BucketKindSchema = z.enum([
  "operating", "payroll", "tax", "emergency", "yield", "custom",
]);

export const bucketRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.buckets.findMany({
      where: eq(buckets.orgId, ctx.orgId),
    });
  }),

  upsert: orgProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),  // omit to create
        kind: BucketKindSchema,
        label: z.string().max(60).optional(),
        targetAmountCents: z.number().int().min(0),
        targetPct: z.number().int().min(0).max(100).nullable().optional(),
        currency: z.string().default("USDC"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [updated] = await ctx.db
          .update(buckets)
          .set({
            kind: input.kind,
            label: input.label,
            targetAmountCents: input.targetAmountCents,
            targetPct: input.targetPct ?? null,
            currency: input.currency,
          })
          .where(and(eq(buckets.id, input.id), eq(buckets.orgId, ctx.orgId)))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }

      const [created] = await ctx.db
        .insert(buckets)
        .values({
          orgId: ctx.orgId,
          kind: input.kind,
          label: input.label,
          targetAmountCents: input.targetAmountCents,
          targetPct: input.targetPct ?? null,
          currency: input.currency,
        })
        .returning();
      return created;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(buckets)
        .where(and(eq(buckets.id, input.id), eq(buckets.orgId, ctx.orgId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
