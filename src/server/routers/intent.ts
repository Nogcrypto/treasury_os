import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, orgProcedure } from "../trpc";
import { intents, executions, events, snapshots } from "@/lib/db/schema";
import { validateAction } from "@/lib/rules-engine/validation";
import { parsePolicy } from "@/lib/rules-engine/policy";
import { policies as policiesTable } from "@/lib/db/schema";
import type { TreasurySnapshot, ScenarioAction } from "@/lib/rules-engine/types";
import { mockRwaAdapter } from "@/lib/adapters/mock-rwa";

const IntentKindSchema = z.enum(["deposit", "withdraw", "rebalance"]);

export const intentRouter = router({
  // List intents for the org
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.intents.findMany({
      where: eq(intents.orgId, ctx.orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 50,
    });
  }),

  // Create a new intent (starts in DRAFT)
  create: orgProcedure
    .input(
      z.object({
        kind: IntentKindSchema,
        adapterId: z.string(),
        amountUsd: z.number().positive(),
        recommendationId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Load active policy and latest snapshot for validation
      const activePolicy = await ctx.db.query.policies.findFirst({
        where: and(
          eq(policiesTable.orgId, ctx.orgId),
          eq(policiesTable.status, "active")
        ),
      });

      const latestSnapshot = await ctx.db.query.snapshots.findFirst({
        where: eq(snapshots.orgId, ctx.orgId),
        orderBy: (t, { desc }) => [desc(t.takenAt)],
      });

      // Validate action against policy before creating intent
      if (activePolicy && latestSnapshot) {
        const policy = parsePolicy({
          ...activePolicy,
          rules: activePolicy.jsonSpec,
        });

        const snapshot = buildSnapshotFromDb(ctx.orgId, latestSnapshot);
        const action: ScenarioAction = {
          kind: input.kind as ScenarioAction["kind"],
          adapterId: input.adapterId,
          amountUsd: input.amountUsd,
        };

        const validation = validateAction(snapshot, policy, action);
        if (!validation.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Policy violation: ${validation.blockers.map((v) => v.message).join("; ")}`,
          });
        }
      }

      const idempotencyKey = `${ctx.orgId}-${input.adapterId}-${input.kind}-${input.amountUsd}-${Date.now()}`;

      const [intent] = await ctx.db
        .insert(intents)
        .values({
          orgId: ctx.orgId,
          kind: input.kind,
          paramsJson: { adapterId: input.adapterId, amountUsd: input.amountUsd } as unknown as Record<string, unknown>,
          status: "draft",
          idempotencyKey,
          recommendationId: input.recommendationId,
        })
        .returning();

      await ctx.db.insert(events).values({
        orgId: ctx.orgId,
        type: "intent.created",
        payloadJson: { intentId: intent.id, kind: input.kind } as unknown as Record<string, unknown>,
      });

      return intent;
    }),

  // Approve an intent (DRAFT → APPROVED)
  approve: orgProcedure
    .input(z.object({ intentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const intent = await ctx.db.query.intents.findFirst({
        where: and(eq(intents.id, input.intentId), eq(intents.orgId, ctx.orgId)),
      });

      if (!intent) throw new TRPCError({ code: "NOT_FOUND" });
      if (intent.status !== "draft" && intent.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot approve intent in status: ${intent.status}` });
      }

      const [updated] = await ctx.db
        .update(intents)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(intents.id, input.intentId))
        .returning();

      await ctx.db.insert(events).values({
        orgId: ctx.orgId,
        type: "intent.approved",
        payloadJson: { intentId: intent.id } as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  // Execute an intent in simulated mode (no on-chain tx)
  executeSimulated: orgProcedure
    .input(z.object({ intentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const intent = await ctx.db.query.intents.findFirst({
        where: and(eq(intents.id, input.intentId), eq(intents.orgId, ctx.orgId)),
      });

      if (!intent) throw new TRPCError({ code: "NOT_FOUND" });
      if (intent.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Intent must be approved first" });
      }

      const params = intent.paramsJson as { adapterId: string; amountUsd: number };
      const simSig = params.adapterId.includes("rwa")
        ? mockRwaAdapter.simulateDeposit(params.amountUsd)
        : `SIM-${intent.id.slice(0, 8)}-${Date.now()}`;

      // Transition: approved → signing → broadcast → confirmed
      await ctx.db.update(intents).set({ status: "signing", updatedAt: new Date() }).where(eq(intents.id, input.intentId));
      await ctx.db.update(intents).set({ status: "broadcast", updatedAt: new Date() }).where(eq(intents.id, input.intentId));
      await ctx.db.update(intents).set({ status: "confirmed", updatedAt: new Date() }).where(eq(intents.id, input.intentId));

      const [execution] = await ctx.db
        .insert(executions)
        .values({
          intentId: intent.id,
          txSignature: simSig,
          status: "confirmed",
          onchainAt: new Date(),
        })
        .returning();

      await ctx.db.insert(events).values({
        orgId: ctx.orgId,
        type: "intent.confirmed.simulated",
        payloadJson: { intentId: intent.id, txSignature: simSig } as unknown as Record<string, unknown>,
      });

      return { intent: { ...intent, status: "confirmed" }, execution };
    }),

  // Reject an intent
  reject: orgProcedure
    .input(z.object({ intentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(intents)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(and(eq(intents.id, input.intentId), eq(intents.orgId, ctx.orgId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});

// ─────────────────────────────────────────────────────────────────────────────

function buildSnapshotFromDb(
  orgId: string,
  row: typeof snapshots.$inferSelect
): TreasurySnapshot {
  const totals = row.totalsJson as { totalUsd: number; liquidUsd: number };
  const positions = (row.positionsJson as unknown[]) ?? [];
  const buckets = (row.bucketsJson as unknown[]) ?? [];

  return {
    id: row.id,
    orgId,
    takenAt: row.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions: positions as TreasurySnapshot["positions"],
    buckets: buckets as TreasurySnapshot["buckets"],
    obligations: [],
  };
}
