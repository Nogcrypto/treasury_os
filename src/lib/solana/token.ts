import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL =
  process.env.HELIUS_RPC_URL ??
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
  "https://api.devnet.solana.com";

// SPL Token program ID (mainnet + devnet)
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export interface TokenOnchainData {
  mint: string;
  decimals: number;
  supply: number;               // raw units
  uiSupply: number;             // human-readable
  topHolders: {
    address: string;
    uiAmount: number;
    pct: number;
  }[];
}

export async function getTokenOnchainData(mint: string): Promise<TokenOnchainData | null> {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const mintPubkey = new PublicKey(mint);

    const [supplyRes, holdersRes] = await Promise.all([
      connection.getTokenSupply(mintPubkey),
      connection.getTokenLargestAccounts(mintPubkey),
    ]);

    const supply = Number(supplyRes.value.amount);
    const uiSupply = supplyRes.value.uiAmount ?? 0;
    const decimals = supplyRes.value.decimals;

    const topHolders = (holdersRes.value ?? []).slice(0, 10).map((h) => ({
      address: h.address.toBase58(),
      uiAmount: h.uiAmount ?? 0,
      pct: uiSupply > 0 ? ((h.uiAmount ?? 0) / uiSupply) * 100 : 0,
    }));

    return { mint, decimals, supply, uiSupply, topHolders };
  } catch {
    return null;
  }
}

// Build the raw instruction data for SPL Token InitializeMint (instruction index 0)
// Layout: [u8 index=0, u8 decimals, [32]u8 mint_authority, u8 freeze_option=0]
export function buildInitializeMintData(decimals: number, mintAuthority: PublicKey): Buffer {
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0);                               // InitializeMint = 0
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);              // mint_authority (32 bytes)
  data.writeUInt8(0, 34);                              // freeze_authority = None
  Buffer.alloc(32).copy(data, 35);                    // freeze_authority pubkey (zeros)
  return data;
}
