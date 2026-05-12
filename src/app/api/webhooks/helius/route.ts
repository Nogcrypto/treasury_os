import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { events, snapshots, organizations, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fetchWalletBalances } from "@/lib/solana/indexer";

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET ?? "";

// Helius Enhanced Webhook payload (simplified)
interface HeliusEvent {
  type: string;
  signature: string;
  timestamp: number;
  accountData: { account: string; nativeBalanceChange: number; tokenBalanceChanges: unknown[] }[];
  feePayer?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify webhook signature
  const authHeader = req.headers.get("authorization");
  if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HeliusEvent[];
  try {
    body = await req.json() as HeliusEvent[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of body) {
    await processHeliusEvent(event);
  }

  return NextResponse.json({ ok: true });
}

async function processHeliusEvent(event: HeliusEvent): Promise<void> {
  // Find the org that owns the affected wallet
  const affectedAddresses = event.accountData.map((a) => a.account);

  for (const address of affectedAddresses) {
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.address, address),
    });
    if (!wallet) continue;

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, wallet.orgId),
    });
    if (!org) continue;

    // Record the raw event in the event log
    await db.insert(events).values({
      orgId: org.id,
      type: `helius.${event.type.toLowerCase()}`,
      payloadJson: event as unknown as Record<string, unknown>,
    });

    // Trigger a fresh snapshot for this org
    await takeSnapshot(org.id, address);
  }
}

async function takeSnapshot(orgId: string, walletAddress: string): Promise<void> {
  try {
    const balances = await fetchWalletBalances(walletAddress);

    await db.insert(snapshots).values({
      orgId,
      totalsJson: {
        totalUsd: balances.stablecoinBalance,
        liquidUsd: balances.stablecoinBalance,
        solLamports: balances.solLamports.toString(),
      } as unknown as Record<string, unknown>,
      positionsJson: [] as unknown as Record<string, unknown>,
      bucketsJson: {} as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error(`Snapshot failed for org ${orgId}:`, err);
  }
}
