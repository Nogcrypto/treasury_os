import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { obligations } from "@/lib/db/schema";

export const obligationRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.obligations.findMany({
      where: eq(obligations.orgId, ctx.orgId),
      orderBy: (t, { asc }) => [asc(t.dueDate)],
    });
  }),

  create: orgProcedure
    .input(
      z.object({
        label: z.string().min(1).max(120),
        amountCents: z.number().int().min(1),
        dueDate: z.string().datetime(),
        recurrence: z.enum(["once", "monthly", "quarterly", "annual"]).default("once"),
        bucketId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(obligations)
        .values({
          orgId: ctx.orgId,
          label: input.label,
          amountCents: input.amountCents,
          dueDate: new Date(input.dueDate),
          recurrence: input.recurrence,
          bucketId: input.bucketId ?? null,
        })
        .returning();
      return created;
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(120).optional(),
        amountCents: z.number().int().min(1).optional(),
        dueDate: z.string().datetime().optional(),
        recurrence: z.enum(["once", "monthly", "quarterly", "annual"]).optional(),
        bucketId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [updated] = await ctx.db
        .update(obligations)
        .set({
          ...(fields.label !== undefined && { label: fields.label }),
          ...(fields.amountCents !== undefined && { amountCents: fields.amountCents }),
          ...(fields.dueDate !== undefined && { dueDate: new Date(fields.dueDate) }),
          ...(fields.recurrence !== undefined && { recurrence: fields.recurrence }),
          ...(fields.bucketId !== undefined && { bucketId: fields.bucketId }),
        })
        .where(and(eq(obligations.id, id), eq(obligations.orgId, ctx.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(obligations)
        .where(and(eq(obligations.id, input.id), eq(obligations.orgId, ctx.orgId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
