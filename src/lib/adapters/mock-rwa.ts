// Mock RWA adapter — simulates Ondo USDY (T-Bills tokenized, ~4.8% APR)
// In simulated mode: no on-chain tx, positions persisted in mock_positions table.
// In devnet real mode: still no on-chain tx (mock protocol doesn't exist on devnet),
// but emits a SIM-prefixed signature to distinguish from Kamino txs.

import type { PublicKey, Transaction } from "@solana/web3.js";
import type { AllocationAdapter, QuoteResult, PositionResult } from "./interface";

const FIXED_APR = 4.82;
const REDEEM_DELAY_DAYS = 1;
const MANAGEMENT_FEE_PCT = 0.001; // 0.1% on deposit

export class MockRwaAdapter implements AllocationAdapter {
  readonly id = "mock-rwa-usdy";
  readonly protocol = "Mock RWA (USDY-like)";
  readonly asset = "USDY";
  readonly kind = "rwa" as const;
  readonly riskTier = 2 as const;

  async quote(amountUsd: number): Promise<QuoteResult> {
    return {
      apr: FIXED_APR,
      fees: amountUsd * MANAGEMENT_FEE_PCT,
      unlockDays: REDEEM_DELAY_DAYS,
    };
  }

  // Returns a placeholder Transaction — caller must check simulated flag before sending.
  async buildDepositTx(_wallet: PublicKey, _amountUsdc: number): Promise<Transaction> {
    throw new Error("MockRwaAdapter: use simulateDeposit() — no real tx");
  }

  async buildWithdrawTx(_wallet: PublicKey, _amountUsdc: number): Promise<Transaction> {
    throw new Error("MockRwaAdapter: use simulateWithdraw() — no real tx");
  }

  async readPosition(_wallet: PublicKey): Promise<PositionResult> {
    // In production this queries mock_positions table via the server.
    // Client-side adapters should not call this directly — use the tRPC snapshot route.
    return { amountUsd: 0, accruedYieldUsd: 0, depositedAt: new Date() };
  }

  // Simulated deposit: returns a SIM tx signature (no on-chain activity)
  simulateDeposit(amountUsd: number): string {
    const id = crypto.randomUUID().slice(0, 8);
    return `SIM-RWA-${id}-${amountUsd}`;
  }

  simulateWithdraw(amountUsd: number): string {
    const id = crypto.randomUUID().slice(0, 8);
    return `SIM-RWA-WD-${id}-${amountUsd}`;
  }

  // Server-side: compute accrued yield for a position
  computeAccruedYield(amountUsd: number, depositedAt: Date): number {
    const daysSinceDeposit = (Date.now() - depositedAt.getTime()) / (1000 * 60 * 60 * 24);
    return amountUsd * (FIXED_APR / 100) * (daysSinceDeposit / 365);
  }

  isRedeemable(depositedAt: Date): boolean {
    const daysSinceDeposit = (Date.now() - depositedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceDeposit >= REDEEM_DELAY_DAYS;
  }
}

export const mockRwaAdapter = new MockRwaAdapter();
