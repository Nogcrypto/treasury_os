"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, policies, recommendations, intents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isDemoUser } from "@/lib/demo";

export interface ProposalActionInput {
  kind: string;
  adapterId: string;
  amountUsd: number;
}

export async function approveProposal(
  actions: ProposalActionInput[],
  rationale: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  if (isDemoUser(user.email)) return { ok: true };

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) return { ok: false, error: "sem organização" };
  const orgId = membership.orgId;

  const activePolicy = await db.query.policies.findFirst({
    where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
  });

  try {
    await db.insert(recommendations).values({
      orgId,
      policyVersion: activePolicy?.version ?? 1,
      rationale,
      actionsJson: actions as unknown as Record<string, unknown>[],
      status: "pending",
    });

    for (const action of actions) {
      const idempotencyKey = `${orgId}-copilot-${action.kind}-${action.adapterId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(intents).values({
        orgId,
        kind: action.kind as "deposit" | "withdraw" | "rebalance",
        paramsJson: { adapterId: action.adapterId, amountUsd: action.amountUsd } as unknown as Record<string, unknown>,
        status: "proposed",
        idempotencyKey,
      });
    }

    revalidatePath("/execution");
    return { ok: true };
  } catch (err) {
    console.error("approveProposal error:", err);
    return { ok: false, error: "Falha ao aprovar proposta." };
  }
}
