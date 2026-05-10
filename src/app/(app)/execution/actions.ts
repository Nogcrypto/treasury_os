"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, intents, executions, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { mockRwaAdapter } from "@/lib/adapters/mock-rwa";

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  return membership?.orgId ?? null;
}

export async function approveIntent(
  intentId: string
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { ok: false, error: "não autenticado" };

  const intent = await db.query.intents.findFirst({
    where: and(eq(intents.id, intentId), eq(intents.orgId, orgId)),
  });
  if (!intent) return { ok: false, error: "intent não encontrado" };
  if (!["draft", "proposed"].includes(intent.status)) {
    return { ok: false, error: `status inválido: ${intent.status}` };
  }

  await db
    .update(intents)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(intents.id, intentId));

  await db.insert(events).values({
    orgId,
    type: "intent.approved",
    payloadJson: { intentId } as unknown as Record<string, unknown>,
  });

  revalidatePath("/execution");
  return { ok: true };
}

export async function executeSimulated(
  intentId: string
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { ok: false, error: "não autenticado" };

  const intent = await db.query.intents.findFirst({
    where: and(eq(intents.id, intentId), eq(intents.orgId, orgId)),
  });
  if (!intent) return { ok: false, error: "intent não encontrado" };
  if (intent.status !== "approved") {
    return { ok: false, error: "intent precisa estar aprovado" };
  }

  const params = intent.paramsJson as { adapterId: string; amountUsd: number };
  const simSig = params.adapterId.includes("rwa")
    ? mockRwaAdapter.simulateDeposit(params.amountUsd)
    : `SIM-${intent.id.slice(0, 8)}-${Date.now()}`;

  for (const status of ["signing", "broadcast", "confirmed"] as const) {
    await db
      .update(intents)
      .set({ status, updatedAt: new Date() })
      .where(eq(intents.id, intentId));
  }

  await db.insert(executions).values({
    intentId: intent.id,
    txSignature: simSig,
    status: "confirmed",
    onchainAt: new Date(),
  });

  await db.insert(events).values({
    orgId,
    type: "intent.confirmed.simulated",
    payloadJson: { intentId, txSignature: simSig } as unknown as Record<string, unknown>,
  });

  revalidatePath("/execution");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectIntent(
  intentId: string
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { ok: false, error: "não autenticado" };

  const result = await db
    .update(intents)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(intents.id, intentId), eq(intents.orgId, orgId)))
    .returning();

  if (!result.length) return { ok: false, error: "intent não encontrado" };

  revalidatePath("/execution");
  return { ok: true };
}
