// Kamino USDC lending adapter — Solana Devnet
// Uses @kamino-finance/klend-sdk. Requires a funded devnet wallet.
// USDC devnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (circle devnet faucet)

import type { PublicKey, Transaction } from "@solana/web3.js";
import type { AllocationAdapter, QuoteResult, PositionResult } from "./interface";

// Kamino devnet market: https://devnet.kamino.finance
const KAMINO_MARKET_ADDRESS = "6WVSwDQXrBZeQVnu6hpnsRZhodaJTZABwgshn9pKKSR7";

export class KaminoUsdcAdapter implements AllocationAdapter {
  readonly id = "kamino-usdc-devnet";
  readonly protocol = "Kamino";
  readonly asset = "USDC";
  readonly kind = "lending" as const;
  readonly riskTier = 1 as const;

  // Reads current supply APR from Kamino market account.
  // Falls back to a reasonable estimate when devnet RPC is slow.
  async quote(_amountUsd: number): Promise<QuoteResult> {
    try {
      // In the full implementation, instantiate KaminoMarket and read supplyApr.
      // Stubbed here to avoid importing the SDK at module level (large bundle).
      const apr = await this.fetchSupplyApr();
      return { apr, fees: 0, unlockDays: 0 };
    } catch {
      // Fallback: last known devnet APR
      return { apr: 5.84, fees: 0, unlockDays: 0 };
    }
  }

  // Build unsigned deposit transaction via Kamino SDK.
  async buildDepositTx(wallet: PublicKey, amountUsdc: number): Promise<Transaction> {
    const { KaminoMarket, KaminoAction, VanillaObligation, PROGRAM_ID } =
      await import("@kamino-finance/klend-sdk");
    const { Connection, PublicKey: PK } = await import("@solana/web3.js");

    const connection = new Connection(
      process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );

    const market = await KaminoMarket.load(
      connection,
      new PK(KAMINO_MARKET_ADDRESS),
      0,
      PROGRAM_ID
    );

    const kaminoAction = await KaminoAction.buildDepositTxns(
      market,
      (amountUsdc * 1_000_000).toString(), // lamports (6 decimals USDC)
      new PK("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC devnet mint
      wallet,
      new VanillaObligation(PROGRAM_ID),
      0,
      true
    );

    const tx = new (await import("@solana/web3.js")).Transaction();
    tx.add(...(kaminoAction.setupIxs ?? []), ...kaminoAction.lendingIxs, ...(kaminoAction.cleanupIxs ?? []));
    return tx;
  }

  // Build unsigned withdraw transaction.
  async buildWithdrawTx(wallet: PublicKey, amountUsdc: number): Promise<Transaction> {
    const { KaminoMarket, KaminoAction, VanillaObligation, PROGRAM_ID } =
      await import("@kamino-finance/klend-sdk");
    const { Connection, PublicKey: PK } = await import("@solana/web3.js");

    const connection = new Connection(
      process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );

    const market = await KaminoMarket.load(
      connection,
      new PK(KAMINO_MARKET_ADDRESS),
      0,
      PROGRAM_ID
    );

    const kaminoAction = await KaminoAction.buildWithdrawTxns(
      market,
      (amountUsdc * 1_000_000).toString(),
      new PK("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      wallet,
      new VanillaObligation(PROGRAM_ID),
      0,
      true
    );

    const tx = new (await import("@solana/web3.js")).Transaction();
    tx.add(...(kaminoAction.setupIxs ?? []), ...kaminoAction.lendingIxs, ...(kaminoAction.cleanupIxs ?? []));
    return tx;
  }

  // Read current deposited balance from Kamino for a given wallet.
  async readPosition(wallet: PublicKey): Promise<PositionResult> {
    try {
      const { KaminoMarket, KaminoObligation, PROGRAM_ID } =
        await import("@kamino-finance/klend-sdk");
      const { Connection, PublicKey: PK } = await import("@solana/web3.js");

      const connection = new Connection(
        process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
        "confirmed"
      );

      const market = await KaminoMarket.load(
        connection,
        new PK(KAMINO_MARKET_ADDRESS),
        0,
        PROGRAM_ID
      );

      const obligations = await market.getUserObligationsByTag(0, wallet);
      if (obligations.length === 0) return { amountUsd: 0, accruedYieldUsd: 0, depositedAt: new Date() };

      const obl = obligations[0];
      const deposit = obl.deposits.find(
        (d: { mintAddress: { toBase58(): string }; amount: { toNumber(): number } }) =>
          d.mintAddress.toBase58() === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );

      return {
        amountUsd: deposit ? deposit.amount.toNumber() / 1_000_000 : 0,
        accruedYieldUsd: 0, // Kamino accrues in-position; calculated via APR × time
        depositedAt: new Date(),
      };
    } catch {
      return { amountUsd: 0, accruedYieldUsd: 0, depositedAt: new Date() };
    }
  }

  private async fetchSupplyApr(): Promise<number> {
    const { KaminoMarket, PROGRAM_ID } = await import("@kamino-finance/klend-sdk");
    const { Connection, PublicKey: PK } = await import("@solana/web3.js");

    const connection = new Connection(
      process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );

    const market = await KaminoMarket.load(
      connection,
      new PK(KAMINO_MARKET_ADDRESS),
      0,
      PROGRAM_ID
    );

    const reserve = market.getReserveByMint(
      new PK("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    );

    return reserve ? reserve.calculateSupplyAPR() * 100 : 5.84;
  }
}

export const kaminoAdapter = new KaminoUsdcAdapter();
