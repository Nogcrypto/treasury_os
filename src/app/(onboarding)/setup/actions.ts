"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import {
  organizations,
  memberships,
  buckets,
  policies,
  users,
  wallets,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { verifySiwsAndLinkWallet } from "@/lib/solana/siws";

const DEFAULT_BUCKETS: {
  kind: typeof buckets.$inferInsert["kind"];
  label: string;
}[] = [
  { kind: "operating", label: "Operacional" },
  { kind: "payroll", label: "Folha" },
  { kind: "tax", label: "Impostos" },
  { kind: "emergency", label: "Reserva" },
  { kind: "yield", label: "Excedente" },
];

export async function createOrg(data: {
  name: string;
  profile: "startup" | "dao" | "fund";
  monthlyBurnUsd: number;
  simulatedMode: boolean;
}): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "não autenticado" };

    await db
      .insert(users)
      .values({ id: user.id, email: user.email ?? "" })
      .onConflictDoNothing();

    const [org] = await db
      .insert(organizations)
      .values({
        name: data.name,
        profile: data.profile,
        monthlyBurnUsd: data.monthlyBurnUsd,
        simulatedMode: data.simulatedMode,
      })
      .returning();

    await db.insert(memberships).values({
      orgId: org.id,
      userId: user.id,
      role: "owner",
    });

    await db.insert(buckets).values(
      DEFAULT_BUCKETS.map((b) => ({
        ...b,
        orgId: org.id,
        targetAmountCents: 0,
      }))
    );

    const preset = POLICY_PRESETS.balanced;
    await db.insert(policies).values({
      orgId: org.id,
      version: 1,
      status: "active",
      preset: "balanced",
      jsonSpec: preset.rules as unknown as Record<string, unknown>[],
      activatedAt: new Date(),
    });

    return { ok: true, orgId: org.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("createOrg error:", msg);
    return { ok: false, error: msg };
  }
}

export async function linkWallet(params: {
  address: string;
  signature: string;
  message: string;
  orgId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return verifySiwsAndLinkWallet({ ...params, label: "Phantom" });
}

export async function setOrgPreset(
  orgId: string,
  preset: "conservative" | "balanced" | "aggressive"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const active = await db.query.policies.findFirst({
      where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
    });
    if (!active) return { ok: false, error: "Política ativa não encontrada." };

    const presetData = POLICY_PRESETS[preset];
    await db
      .update(policies)
      .set({
        preset,
        jsonSpec: presetData.rules as unknown as Record<string, unknown>[],
      })
      .where(eq(policies.id, active.id));

    return { ok: true };
  } catch (err) {
    console.error("setOrgPreset error:", err);
    return { ok: false, error: "Falha ao atualizar política." };
  }
}

export async function updateBucketTargets(
  orgId: string,
  targets: { kind: string; amountCents: number }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    await Promise.all(
      targets.map((t) =>
        db
          .update(buckets)
          .set({ targetAmountCents: t.amountCents })
          .where(
            and(
              eq(buckets.orgId, orgId),
              eq(buckets.kind, t.kind as typeof buckets.$inferInsert["kind"])
            )
          )
      )
    );
    return { ok: true };
  } catch (err) {
    console.error("updateBucketTargets error:", err);
    return { ok: false, error: "Falha ao salvar buckets." };
  }
}
