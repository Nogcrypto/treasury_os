import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, equityTokens, equityDividends } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isDemoUser } from "@/lib/demo";
import { getTokenOnchainData } from "@/lib/solana/token";
import { TokenStudio } from "@/components/equity/TokenStudio";
import { TokenSetupClientWrapper } from "@/components/equity/TokenSetupClientWrapper";

export const dynamic = "force-dynamic";

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_TOKEN = {
  id: "demo-token",
  orgId: "demo-capivara-ventures",
  mint: "CAPi4rMzxSw9rBBd1TWGCqRGMpYU9ZQCX7VQPmXUqgN",
  symbol: "CAPI",
  name: "Capivara Labs Equity Token",
  decimals: 6,
  totalSupply: 10_000_000_000_000,  // 10M × 1e6
  priceUsdcE6: 82_000,              // $0.082
  poolAddress: "CAPiPooL9xK3y8WzTkLrJEPLHb2DRaXtaAB47V3M111",
  poolAprBps: 1840,
  totalDividendsCents: 2_450_000,
  createdAt: new Date("2026-01-15"),
};

const DEMO_ONCHAIN = {
  mint: DEMO_TOKEN.mint,
  decimals: 6,
  supply: 10_000_000_000_000,
  uiSupply: 10_000_000,
  topHolders: [
    { address: "8xZkN3qPTreasury1111111111111111111111111111", uiAmount: 4_500_000, pct: 45.0 },
    { address: "TeamFounderVesting22222222222222222222222222", uiAmount: 2_000_000, pct: 20.0 },
    { address: "LiquidityPool3Raydium33333333333333333333333", uiAmount: 1_650_000, pct: 16.5 },
    { address: "AngelInvestor0xluna44444444444444444444444444", uiAmount: 1_200_000, pct: 12.0 },
    { address: "FreeFloat555555555555555555555555555555555555", uiAmount:   650_000, pct:  6.5 },
  ],
};

const DEMO_DIVIDENDS = [
  { id: "dd1", amountCents: 820_000, perTokenUsdc: "0.00044", recipientsCount: 312, txSignature: "5xNpQ2WvK9mT8pLzR6QsYjKbVN3cXhF7aDE4uCwMtPy", status: "confirmed", distributedAt: new Date("2026-04-15"), createdAt: new Date("2026-04-15") },
  { id: "dd2", amountCents: 950_000, perTokenUsdc: "0.00051", recipientsCount: 298, txSignature: "3kLmR7YcN4pXwQvH2sT5jFnDgBuZ8eAW6rCyMoKiPbV", status: "confirmed", distributedAt: new Date("2026-01-15"), createdAt: new Date("2026-01-15") },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EquityStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── Demo user: static data ──
  if (isDemoUser(user.email)) {
    return (
      <TokenStudio
        token={DEMO_TOKEN}
        onchain={DEMO_ONCHAIN}
        dividends={DEMO_DIVIDENDS}
        orgName="Capivara Ventures"
      />
    );
  }

  // ── Real user: check org + token config ──
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });

  if (!membership) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-sm text-fg-2 mb-4">Configure sua organização primeiro.</div>
          <a href="/setup" className="text-sm text-accent hover:underline">Iniciar onboarding →</a>
        </div>
      </div>
    );
  }

  const orgId = membership.orgId;

  const [token, dividends] = await Promise.all([
    db.query.equityTokens.findFirst({ where: eq(equityTokens.orgId, orgId) }),
    db.query.equityDividends.findMany({
      where: eq(equityDividends.orgId, orgId),
      orderBy: [desc(equityDividends.createdAt)],
    }),
  ]);

  // ── No token configured: show setup wizard ──
  if (!token) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="text-[10px] text-fg-3 font-mono uppercase tracking-wider mb-4">
          WORKSPACE / TOKEN STUDIO
        </div>
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-fg mb-1">Token Studio · {membership.org.name}</h1>
          <p className="text-xs text-fg-2 max-w-lg">
            Emita um token de equity da empresa, abasteça pool próprio e distribua dividendos on-chain.
            Compliance e audit trail integrados ao Policy Engine.
          </p>
        </div>
        <TokenSetupClientWrapper />
      </div>
    );
  }

  // ── Token configured: fetch real on-chain data ──
  const onchain = await getTokenOnchainData(token.mint);

  return (
    <TokenStudio
      token={{
        ...token,
        totalSupply: token.totalSupply ?? null,
        priceUsdcE6: token.priceUsdcE6 ?? null,
        poolAddress: token.poolAddress ?? null,
        poolAprBps: token.poolAprBps ?? null,
      }}
      onchain={onchain}
      dividends={dividends.map((d) => ({
        id: d.id,
        amountCents: Number(d.amountCents),
        perTokenUsdc: d.perTokenUsdc ?? null,
        recipientsCount: d.recipientsCount ?? null,
        txSignature: d.txSignature ?? null,
        status: d.status,
        distributedAt: d.distributedAt ?? null,
        createdAt: d.createdAt,
      }))}
      orgName={membership.org.name}
    />
  );
}
