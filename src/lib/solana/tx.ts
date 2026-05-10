// Solana transaction helpers.
// In simulated mode (simulatedMode: true) these are stubs.
// For real devnet execution, wire in adapter buildDepositTx / buildWithdrawTx.

export interface TxParams {
  adapterId: string;
  kind: "deposit" | "withdraw";
  amountUsd: number;
  walletAddress: string;
}

// Build a serialized transaction for the given params.
// Returns null in simulated mode (caller should use SIM-* signature instead).
export async function buildTx(
  params: TxParams,
  isSimulated: boolean
): Promise<Uint8Array | null> {
  if (isSimulated) return null;

  // TODO: delegate to adapter-specific tx builders for real devnet
  // e.g. kaminoAdapter.buildDepositTx(pubkey, params.amountUsd)
  return null;
}

// Sign and send a serialized transaction. Returns the tx signature.
// Falls back to a SIM-* signature in simulated mode.
export async function signAndSend(
  tx: Uint8Array | null,
  signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>,
  _connection: unknown,
  isSimulated: boolean
): Promise<string> {
  if (isSimulated || tx === null) {
    return `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const signed = await signTransaction(tx);
  const raw = signed.serialize();

  // sendRawTransaction via Helius RPC
  const response = await fetch(
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendRawTransaction",
        params: [Buffer.from(raw).toString("base64"), { encoding: "base64" }],
      }),
    }
  );
  const json = (await response.json()) as { result?: string; error?: unknown };
  if (!json.result) throw new Error(`Tx failed: ${JSON.stringify(json.error)}`);
  return json.result;
}

// Confirm a transaction with retries (up to 30s).
export async function confirmTx(
  signature: string,
  rpcUrl: string = "https://api.devnet.solana.com",
  maxRetries = 10
): Promise<boolean> {
  if (signature.startsWith("SIM-")) return true;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[signature], { searchTransactionHistory: true }],
      }),
    });
    const json = (await resp.json()) as {
      result?: { value?: ({ confirmationStatus?: string } | null)[] };
    };
    const status = json.result?.value?.[0]?.confirmationStatus;
    if (status === "confirmed" || status === "finalized") return true;
  }
  return false;
}
