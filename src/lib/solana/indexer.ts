import "server-only";

const HELIUS_RPC = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

// Stablecoin mints on Solana devnet — each treated as 1:1 USD.
const DEVNET_STABLECOINS: Record<string, string> = {
  // USDC — Kamino devnet + maioria dos DeFi Solana devnet
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  // USDC — Circle devnet faucet oficial (faucet.circle.com → devnet)
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC",
  // USDT — Saber/Mercurial devnet test mint
  "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS": "USDT",
  // USDH — Hubble Protocol devnet
  "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX": "USDH",
  // PYUSD — PayPal USD devnet (Solana Foundation developer program)
  "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM": "PYUSD",
};

// Export so adapters and tests can reference the same set without duplicating.
export const DEVNET_STABLECOIN_MINTS = DEVNET_STABLECOINS;

export interface WalletBalances {
  solLamports: bigint;
  tokens: { mint: string; symbol: string; balance: number; decimals: number }[];
  stablecoinBalance: number;
}

// Fetch SOL and SPL token balances for a wallet address via Helius RPC.
export async function fetchWalletBalances(walletAddress: string): Promise<WalletBalances> {
  const [solResp, tokenResp] = await Promise.all([
    rpc("getBalance", [walletAddress]),
    rpc("getTokenAccountsByOwner", [
      walletAddress,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]),
  ]);

  const solResult = solResp.result as { value?: number } | undefined;
  const tokenResult = tokenResp.result as { value?: TokenAccount[] } | undefined;

  const solLamports = BigInt(solResult?.value ?? 0);

  const tokens: WalletBalances["tokens"] = (tokenResult?.value ?? []).map(
    (account: TokenAccount) => {
      const info = account.account.data.parsed.info;
      return {
        mint: info.mint,
        symbol: DEVNET_STABLECOINS[info.mint] ?? "UNKNOWN",
        balance: info.tokenAmount.uiAmount ?? 0,
        decimals: info.tokenAmount.decimals,
      };
    }
  );

  const stablecoinBalance = tokens
    .filter((t) => t.mint in DEVNET_STABLECOINS)
    .reduce((sum, t) => sum + t.balance, 0);

  return { solLamports, tokens, stablecoinBalance };
}

// Subscribe to balance changes via Helius Enhanced Webhooks.
// Returns the webhook ID for management.
export async function registerHeliusWebhook(
  walletAddress: string,
  webhookUrl: string
): Promise<string> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) throw new Error("HELIUS_API_KEY not set");

  const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: webhookUrl,
      transactionTypes: ["TRANSFER"],
      accountAddresses: [walletAddress],
      webhookType: "enhanced",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Helius webhook registration failed: ${text}`);
  }

  const data = await response.json() as { webhookID: string };
  return data.webhookID;
}

// Fetch transaction history for an account (up to 10 most recent)
export async function fetchRecentTransactions(walletAddress: string, limit = 10) {
  const signaturesResp = await rpc("getSignaturesForAddress", [
    walletAddress,
    { limit },
  ]);
  return (signaturesResp.result ?? []) as { signature: string; blockTime: number; err: null | object }[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface TokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: { uiAmount: number; decimals: number };
        };
      };
    };
  };
}

async function rpc(method: string, params: unknown[]): Promise<{ result?: unknown }> {
  const resp = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return resp.json() as Promise<{ result?: unknown }>;
}
