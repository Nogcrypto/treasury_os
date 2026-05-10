import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, orgProcedure } from "../trpc";
import {
  organizations,
  memberships,
  buckets,
  users,
} from "@/lib/db/schema";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { policies } from "@/lib/db/schema";

const DEFAULT_BUCKETS: { kind: typeof buckets.$inferInsert["kind"]; label: string; targetAmountCents: number }[] = [
  { kind: "operating", label: "Operacional",  targetAmountCents: 0 },
  { kind: "payroll",   label: "Folha",        targetAmountCents: 0 },
  { kind: "tax",       label: "Impostos",     targetAmountCents: 0 },
  { kind: "emergency", label: "Reserva",      targetAmountCents: 0 },
  { kind: "yield",     label: "Excedente",    targetAmountCents: 0 },
];

export const orgRouter = router({
  // Get the current user's org (first membership)
  getMyOrg: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.db.query.memberships.findFirst({
      where: eq(memberships.userId, ctx.userId),
      with: { org: true },
    });
    return membership ?? null;
  }),

  // Create org, seed default buckets + balanced policy, add membership
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(80),
        profile: z.enum(["startup", "dao", "fund"]).default("startup"),
        monthlyBurnUsd: z.number().int().min(0).default(0),
        simulatedMode: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure user row exists (trigger should create it, but defensive)
      await ctx.db
        .insert(users)
        .values({ id: ctx.userId, email: "" })
        .onConflictDoNothing();

      // Create org
      const [org] = await ctx.db
        .insert(organizations)
        .values({
          name: input.name,
          profile: input.profile,
          monthlyBurnUsd: input.monthlyBurnUsd,
          simulatedMode: input.simulatedMode,
        })
        .returning();

      // Create membership
      await ctx.db.insert(memberships).values({
        orgId: org.id,
        userId: ctx.userId,
        role: "owner",
      });

      // Seed default buckets
      await ctx.db.insert(buckets).values(
        DEFAULT_BUCKETS.map((b) => ({ ...b, orgId: org.id }))
      );

      // Seed balanced policy as active
      const preset = POLICY_PRESETS.balanced;
      await ctx.db.insert(policies).values({
        orgId: org.id,
        version: 1,
        status: "active",
        preset: "balanced",
        jsonSpec: preset.rules as unknown as Record<string, unknown>[],
        activatedAt: new Date(),
      });

      return org;
    }),

  // Update org settings
  update: orgProcedure
    .input(
      z.object({
        name: z.string().min(2).max(80).optional(),
        monthlyBurnUsd: z.number().int().min(0).optional(),
        simulatedMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(organizations)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.monthlyBurnUsd !== undefined && { monthlyBurnUsd: input.monthlyBurnUsd }),
          ...(input.simulatedMode !== undefined && { simulatedMode: input.simulatedMode }),
        })
        .where(eq(organizations.id, ctx.orgId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});
