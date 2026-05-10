// Temporary type stub for @kamino-finance/klend-sdk
// Replace with actual types once SDK is installed and types are available.
declare module "@kamino-finance/klend-sdk" {
  import type { PublicKey, Connection } from "@solana/web3.js";

  export const PROGRAM_ID: PublicKey;

  export class KaminoMarket {
    static load(
      connection: Connection,
      address: PublicKey,
      slot: number,
      programId: PublicKey
    ): Promise<KaminoMarket>;
    getReserveByMint(mint: PublicKey): KaminoReserve | undefined;
    getUserObligationsByTag(tag: number, wallet: PublicKey): Promise<KaminoObligation[]>;
  }

  export class KaminoReserve {
    calculateSupplyAPR(): number;
  }

  export class KaminoObligation {
    deposits: Array<{
      mintAddress: PublicKey;
      amount: { toNumber(): number };
    }>;
  }

  export class KaminoAction {
    setupIxs?: import("@solana/web3.js").TransactionInstruction[];
    lendingIxs: import("@solana/web3.js").TransactionInstruction[];
    cleanupIxs?: import("@solana/web3.js").TransactionInstruction[];

    static buildDepositTxns(
      market: KaminoMarket,
      amount: string,
      mint: PublicKey,
      wallet: PublicKey,
      obligation: VanillaObligation,
      slot: number,
      skipPreflight: boolean
    ): Promise<KaminoAction>;

    static buildWithdrawTxns(
      market: KaminoMarket,
      amount: string,
      mint: PublicKey,
      wallet: PublicKey,
      obligation: VanillaObligation,
      slot: number,
      skipPreflight: boolean
    ): Promise<KaminoAction>;
  }

  export class VanillaObligation {
    constructor(programId: PublicKey);
  }
}
