import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { policies } from "@/lib/db/schema";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";

export const policyRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.policies.findMany({
      where: eq(policies.orgId, ctx.orgId),
      orderBy: [desc(policies.version)],
    });
  }),

  active: orgProcedure.query(async ({ ctx }) => {
    return (
      (await ctx.db.query.policies.findFirst({
        where: and(eq(policies.orgId, ctx.orgId), eq(policies.status, "active")),
      })) ?? null
    );
  }),

  // Create a new draft policy from a preset or custom rules
  create: orgProcedure
    .input(
      z.object({
        preset: z.enum(["conservative", "balanced", "aggressive", "custom"]),
        rules: z.array(z.record(z.string(), z.unknown())).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const latest = await ctx.db.query.policies.findFirst({
        where: eq(policies.orgId, ctx.orgId),
        orderBy: [desc(policies.version)],
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      const presetRules =
        input.preset !== "custom" ? POLICY_PRESETS[input.preset].rules : [];
      const jsonSpec = (input.rules ?? presetRules) as unknown as Record<
        string,
        unknown
      >[];

      const [created] = await ctx.db
        .insert(policies)
        .values({
          orgId: ctx.orgId,
          version: nextVersion,
          status: "draft",
          preset: input.preset,
          jsonSpec,
          createdBy: ctx.userId,
        })
        .returning();
      return created;
    }),

  // Activate a draft policy; archives the current active one
  activate: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(policies)
        .set({ status: "archived" })
        .where(
          and(eq(policies.orgId, ctx.orgId), eq(policies.status, "active"))
        );

      const [activated] = await ctx.db
        .update(policies)
        .set({ status: "active", activatedAt: new Date() })
        .where(
          and(eq(policies.id, input.id), eq(policies.orgId, ctx.orgId))
        )
        .returning();
      if (!activated) throw new TRPCError({ code: "NOT_FOUND" });
      return activated;
    }),

  // Archive a draft policy
  archive: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [archived] = await ctx.db
        .update(policies)
        .set({ status: "archived" })
        .where(
          and(
            eq(policies.id, input.id),
            eq(policies.orgId, ctx.orgId),
            eq(policies.status, "draft")
          )
        )
        .returning();
      if (!archived) throw new TRPCError({ code: "NOT_FOUND" });
      return archived;
    }),

  // Swap the active policy's preset in-place (used by onboarding wizard)
  setPreset: orgProcedure
    .input(
      z.object({
        preset: z.enum(["conservative", "balanced", "aggressive"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const active = await ctx.db.query.policies.findFirst({
        where: and(
          eq(policies.orgId, ctx.orgId),
          eq(policies.status, "active")
        ),
      });
      if (!active)
        throw new TRPCError({ code: "NOT_FOUND", message: "No active policy" });

      const preset = POLICY_PRESETS[input.preset];
      const [updated] = await ctx.db
        .update(policies)
        .set({
          preset: input.preset,
          jsonSpec: preset.rules as unknown as Record<string, unknown>[],
        })
        .where(eq(policies.id, active.id))
        .returning();
      return updated;
    }),
});
