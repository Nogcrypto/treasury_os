"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, policies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { PolicyRule } from "@/lib/rules-engine/types";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function saveAndActivate(
  preset: string,
  rules: PolicyRule[]
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

  try {
    const latest = await db.query.policies.findFirst({
      where: eq(policies.orgId, orgId),
      orderBy: [desc(policies.version)],
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Archive current active
    await db
      .update(policies)
      .set({ status: "archived" })
      .where(and(eq(policies.orgId, orgId), eq(policies.status, "active")));

    // Create and immediately activate
    await db.insert(policies).values({
      orgId,
      version: nextVersion,
      status: "active",
      preset: preset as typeof policies.$inferInsert["preset"],
      jsonSpec: rules as unknown as Record<string, unknown>[],
      createdBy: user.id,
      activatedAt: new Date(),
    });

    revalidatePath("/policy");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("saveAndActivate error:", err);
    return { ok: false, error: "Falha ao salvar política." };
  }
}

export async function policyFromDescription(description: string): Promise<{
  ok: boolean;
  rules?: PolicyRule[];
  preset?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  const prompt = `Você é um especialista em gestão de tesouraria para startups.

Com base na descrição de política abaixo, retorne um JSON válido com a estrutura exata a seguir:
{
  "preset": "conservative" | "balanced" | "aggressive",
  "rules": [
    { "id": "MIN_RUNWAY_DAYS", "enabled": boolean, "params": { "days": number } },
    { "id": "MAX_CONCENTRATION_PCT", "enabled": boolean, "params": { "pct": number } },
    { "id": "MIN_LIQUID_PCT", "enabled": boolean, "params": { "pct": number } },
    { "id": "BUCKET_TARGET", "enabled": boolean, "params": {} },
    { "id": "ALLOCATION_WHITELIST", "enabled": boolean, "params": { "adapters": string[] } },
    { "id": "YIELD_ONLY_EXCESS", "enabled": boolean, "params": {} },
    { "id": "REBALANCE_TRIGGER", "enabled": boolean, "params": { "deviationPct": number } }
  ]
}

Adaptadores disponíveis: "kamino-usdc-devnet", "mock-rwa-usdy"
Retorne APENAS o JSON, sem markdown, sem explicação.

Descrição da política:
${description}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("")
      .trim();

    // Strip markdown code fences if Claude wrapped the JSON despite instructions.
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text) as { preset: string; rules: PolicyRule[] };
    return { ok: true, rules: parsed.rules, preset: parsed.preset };
  } catch (err) {
    console.error("policyFromDescription error:", err);
    return { ok: false, error: "Falha ao gerar política. Tente reformular a descrição." };
  }
}
