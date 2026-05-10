"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, equityTokens, equityDividends } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isDemoUser } from "@/lib/demo";
import { getTokenOnchainData } from "@/lib/solana/token";

async function getOrgId(userId: string): Promise<string | null> {
  const m = await db.query.memberships.findFirst({ where: eq(memberships.userId, userId) });
  return m?.orgId ?? null;
}

// ── Configure / upsert equity token ──────────────────────────────────────────

export async function configureEquityToken(data: {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsdcE6?: number;
  poolAddress?: string;
  poolAprBps?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (isDemoUser(user.email)) return { ok: true };

  const orgId = await getOrgId(user.id);
  if (!orgId) return { ok: false, error: "Organização não encontrada" };

  // Fetch on-chain data to get real supply/decimals
  const onchain = await getTokenOnchainData(data.mint);
  const totalSupply = onchain?.supply ?? undefined;
  const decimals = onchain?.decimals ?? data.decimals;

  try {
    const existing = await db.query.equityTokens.findFirst({
      where: eq(equityTokens.orgId, orgId),
    });
    if (existing) {
      await db.update(equityTokens).set({
        mint: data.mint,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        decimals,
        totalSupply,
        priceUsdcE6: data.priceUsdcE6,
        poolAddress: data.poolAddress,
        poolAprBps: data.poolAprBps,
      }).where(eq(equityTokens.orgId, orgId));
    } else {
      await db.insert(equityTokens).values({
        orgId,
        mint: data.mint,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        decimals,
        totalSupply,
        priceUsdcE6: data.priceUsdcE6,
        poolAddress: data.poolAddress,
        poolAprBps: data.poolAprBps,
        totalDividendsCents: 0,
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Record a dividend distribution ───────────────────────────────────────────

export async function recordDividend(data: {
  tokenMint: string;
  amountCents: number;
  perTokenUsdc?: string;
  recipientsCount?: number;
  txSignature?: string;
  status: "pending" | "confirmed" | "failed";
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (isDemoUser(user.email)) return { ok: true, id: "demo" };

  const orgId = await getOrgId(user.id);
  if (!orgId) return { ok: false, error: "Organização não encontrada" };

  try {
    const [row] = await db.insert(equityDividends).values({
      orgId,
      tokenMint: data.tokenMint,
      amountCents: data.amountCents,
      perTokenUsdc: data.perTokenUsdc,
      recipientsCount: data.recipientsCount,
      txSignature: data.txSignature,
      status: data.status,
      distributedAt: data.status === "confirmed" ? new Date() : undefined,
    }).returning({ id: equityDividends.id });

    // Keep running total on equityTokens
    const all = await db.query.equityDividends.findMany({
      where: eq(equityDividends.orgId, orgId),
    });
    const total = all.reduce((s, d) => s + (d.amountCents ?? 0), 0) + data.amountCents;
    await db.update(equityTokens)
      .set({ totalDividendsCents: total })
      .where(eq(equityTokens.orgId, orgId));

    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Confirm a pending dividend with tx signature ──────────────────────────────

export async function confirmDividend(id: string, txSignature: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (isDemoUser(user.email)) return { ok: true };

  try {
    await db.update(equityDividends)
      .set({ status: "confirmed", txSignature, distributedAt: new Date() })
      .where(eq(equityDividends.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Update pool config ────────────────────────────────────────────────────────

export async function updatePool(data: {
  poolAddress: string;
  poolAprBps: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (isDemoUser(user.email)) return { ok: true };

  const orgId = await getOrgId(user.id);
  if (!orgId) return { ok: false, error: "Organização não encontrada" };

  try {
    await db.update(equityTokens).set(data).where(eq(equityTokens.orgId, orgId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
