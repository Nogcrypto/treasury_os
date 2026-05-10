import "server-only";

const HELIUS_RPC = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const USDC_DEVNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface WalletBalances {
  solLamports: bigint;
  tokens: { mint: string; symbol: string; balance: number; decimals: number }[];
  usdcBalance: number;
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
        symbol: info.mint === USDC_DEVNET_MINT ? "USDC" : "UNKNOWN",
        balance: info.tokenAmount.uiAmount ?? 0,
        decimals: info.tokenAmount.decimals,
      };
    }
  );

  const usdcToken = tokens.find((t) => t.mint === USDC_DEVNET_MINT);
  return { solLamports, tokens, usdcBalance: usdcToken?.balance ?? 0 };
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
