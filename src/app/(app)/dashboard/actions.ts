"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, wallets, snapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchWalletBalances } from "@/lib/solana/indexer";
import { kaminoAdapter } from "@/lib/adapters/kamino";
import { mockRwaAdapter } from "@/lib/adapters/mock-rwa";
import type { TreasurySnapshot } from "@/lib/rules-engine/types";
import { revalidatePath } from "next/cache";

export async function takeSnapshot(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) return { ok: false, error: "org não encontrada" };

  const orgId = membership.orgId;

  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.orgId, orgId), eq(wallets.isPrimary, true)),
  });
  if (!wallet) return { ok: false, error: "Nenhuma wallet principal configurada." };

  try {
    const balances = await fetchWalletBalances(wallet.address);

    const { PublicKey } = await import("@solana/web3.js");
    const pubkey = new PublicKey(wallet.address);
    const [kaminoPos, mockRwaPos] = await Promise.allSettled([
      kaminoAdapter.readPosition(pubkey),
      mockRwaAdapter.readPosition(pubkey),
    ]);

    const positions: TreasurySnapshot["positions"] = [];

    if (kaminoPos.status === "fulfilled" && kaminoPos.value.amountUsd > 0) {
      positions.push({
        adapterId: "kamino-usdc-devnet",
        protocol: "Kamino",
        asset: "USDC",
        amountUsd: kaminoPos.value.amountUsd,
        aprPct: 5.84,
        accruedYieldUsd: kaminoPos.value.accruedYieldUsd,
        riskTier: 1,
        unlockDays: 0,
      });
    }

    if (mockRwaPos.status === "fulfilled" && mockRwaPos.value.amountUsd > 0) {
      positions.push({
        adapterId: "mock-rwa-usdy",
        protocol: "Mock RWA (USDY-like)",
        asset: "USDY",
        amountUsd: mockRwaPos.value.amountUsd,
        aprPct: 4.82,
        accruedYieldUsd: mockRwaPos.value.accruedYieldUsd,
        riskTier: 2,
        unlockDays: 1,
      });
    }

    const deployedUsd = positions.reduce((s, p) => s + p.amountUsd, 0);
    const totalUsd = balances.usdcBalance + deployedUsd;
    const liquidUsd = balances.usdcBalance;

    await db.insert(snapshots).values({
      orgId,
      totalsJson: {
        totalUsd,
        liquidUsd,
        solLamports: balances.solLamports.toString(),
      } as unknown as Record<string, unknown>,
      positionsJson: positions as unknown as Record<string, unknown>[],
      bucketsJson: {} as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("takeSnapshot error:", err);
    return { ok: false, error: "Falha ao capturar snapshot." };
  }
}
