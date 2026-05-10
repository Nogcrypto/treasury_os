import type { PublicKey, Transaction } from "@solana/web3.js";

export interface QuoteResult {
  apr: number;          // annual percentage rate (e.g. 5.84)
  fees: number;         // USD fees estimated for this tx
  unlockDays: number;   // 0 = instant, 1 = next day, etc.
}

export interface PositionResult {
  amountUsd: number;
  accruedYieldUsd: number;
  depositedAt: Date;
}

export interface AllocationAdapter {
  readonly id: string;
  readonly protocol: string;
  readonly asset: string;
  readonly kind: "lending" | "rwa";
  readonly riskTier: 1 | 2 | 3;

  quote(amountUsd: number): Promise<QuoteResult>;
  buildDepositTx(wallet: PublicKey, amountUsdc: number): Promise<Transaction>;
  buildWithdrawTx(wallet: PublicKey, amountUsdc: number): Promise<Transaction>;
  readPosition(wallet: PublicKey): Promise<PositionResult>;
}
