"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, recommendations, policies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ScenarioAction } from "@/lib/rules-engine/types";
import { revalidatePath } from "next/cache";

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
