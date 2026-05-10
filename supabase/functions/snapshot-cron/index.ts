// Supabase Edge Function — snapshot-cron
// Called every 5 minutes via pg_cron:
//   SELECT cron.schedule('snapshot-cron', '*/5 * * * *',
//     $$SELECT net.http_post(url := '<SUPABASE_URL>/functions/v1/snapshot-cron',
//              headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb) AS request_id$$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface WalletRow {
  org_id: string;
  address: string;
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const heliusApiKey = Deno.env.get("HELIUS_API_KEY") ?? "";
  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch all primary wallets
  const { data: wallets, error: walletErr } = await supabase
    .from("wallets")
    .select("org_id, address")
    .eq("is_primary", true);

  if (walletErr) {
    return new Response(JSON.stringify({ error: walletErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { orgId: string; ok: boolean; totalUsd?: number }[] = [];

  for (const wallet of (wallets ?? []) as WalletRow[]) {
    try {
      // SOL balance
      const solRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet.address] }),
      });
      const solData = (await solRes.json()) as { result?: { value?: number } };
      const solLamports = solData.result?.value ?? 0;

      // USDC token balance
      const usdcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getTokenAccountsByOwner",
          params: [wallet.address, { mint: USDC_MINT }, { encoding: "jsonParsed" }],
        }),
      });
      const usdcData = (await usdcRes.json()) as {
        result?: { value?: { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }[] };
      };
      const usdcBalance: number =
        usdcData.result?.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;

      const totalUsd = usdcBalance;

      const { error: insertErr } = await supabase.from("snapshots").insert({
        org_id: wallet.org_id,
        totals_json: {
          totalUsd,
          liquidUsd: totalUsd,
          solLamports: String(solLamports),
        },
        positions_json: [],
        buckets_json: {},
      });

      results.push({ orgId: wallet.org_id, ok: !insertErr, totalUsd });
    } catch (_err) {
      results.push({ orgId: wallet.org_id, ok: false });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results, ts: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
