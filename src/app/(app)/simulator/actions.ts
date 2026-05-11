"use server";

import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, recommendations, policies, intents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ScenarioAction } from "@/lib/rules-engine/types";
import { revalidatePath } from "next/cache";
import { isDemoUser } from "@/lib/demo";

// 5-minute window: retries within the same window hit the UNIQUE constraint and
// onConflictDoNothing absorbs them — same intent isn't created twice.
function intentKey(orgId: string, action: ScenarioAction, index: number): string {
  const window = Math.floor(Date.now() / (5 * 60_000));
  const raw = `${orgId}:${action.kind}:${action.adapterId}:${action.amountUsd}:${window}:${index}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function approveScenario(
  actions: ScenarioAction[],
  rationale: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  if (isDemoUser(user.email)) return { ok: true };

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) return { ok: false, error: "org não encontrada" };
  const orgId = membership.orgId;

  const activePolicy = await db.query.policies.findFirst({
    where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
  });

  try {
    // 1. Save as recommendation
    await db.insert(recommendations).values({
      orgId,
      policyVersion: activePolicy?.version ?? 1,
      rationale,
      actionsJson: actions as unknown as Record<string, unknown>[],
      status: "pending",
    });

    // 2. Create draft intents for each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      await db
        .insert(intents)
        .values({
          orgId,
          kind: action.kind as "deposit" | "withdraw" | "rebalance",
          paramsJson: { adapterId: action.adapterId, amountUsd: action.amountUsd } as unknown as Record<string, unknown>,
          status: "proposed",
          idempotencyKey: intentKey(orgId, action, i),
        })
        .onConflictDoNothing();
    }

    revalidatePath("/execution");
    revalidatePath("/simulator");
    return { ok: true };
  } catch (err) {
    console.error("approveScenario error:", err);
    return { ok: false, error: "Falha ao aprovar cenário." };
  }
}

export async function saveRecommendation(
  actions: ScenarioAction[],
  rationale: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) return { ok: false, error: "org não encontrada" };

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

    revalidatePath("/execution");
    return { ok: true };
  } catch (err) {
    console.error("saveRecommendation error:", err);
    return { ok: false, error: "Falha ao salvar recomendação." };
  }
}
