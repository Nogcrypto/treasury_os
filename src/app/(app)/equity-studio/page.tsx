import { createClient } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/demo";

export const dynamic = "force-dynamic";

// Static equity data — in a production build this would come from an on-chain indexer
const EQUITY_DATA = {
  tokenSymbol: "CAPI",
  tokenName: "Capivara Ventures Token",
  mint: "CAPi4rMzxSw9rBBd1TWGCqRGMpYU9ZQCX7VQPmXUqgN",
  totalSupply: 10_000_000,
  circulating: 1_850_000,
  treasury: 4_500_000,
  teamVested: 2_000_000,
  inPool: 1_650_000,
  price: 0.082,
  priceChange24h: +5.3,
  marketCap: 151_700,
  pool: {
    pair: "CAPI/USDC",
    tvl: 1_202_000,
    apr: 18.4,
    fee: 0.3,
    volume24h: 48_300,
  },
  dividends: {
    totalDistributed: 24_500,
    nextAmount: 8_200,
    nextInDays: 23,
    perToken: 0.0044,
  },
  capTable: [
    { holder: "Treasury (DAO)",      pct: 45.0, tokens: 4_500_000, color: "oklch(0.82 0.18 148)" },
    { holder: "Team (vesting 4yr)",  pct: 20.0, tokens: 2_000_000, color: "oklch(0.78 0.13 200)" },
    { holder: "LP Pool",             pct: 16.5, tokens: 1_650_000, color: "oklch(0.74 0.18 295)" },
    { holder: "Investors Seed",      pct: 12.0, tokens: 1_200_000, color: "oklch(0.82 0.16 80)" },
    { holder: "Circulando",          pct: 6.5,  tokens: 650_000,   color: "oklch(0.68 0.22 25)" },
  ],
  recentTrades: [
    { side: "buy",  amount: 12_500, price: 0.082, time: "2min" },
    { side: "sell", amount:  4_200, price: 0.081, time: "8min" },
    { side: "buy",  amount: 28_000, price: 0.082, time: "15min" },
    { side: "buy",  amount:  6_800, price: 0.081, time: "23min" },
    { side: "sell", amount:  9_100, price: 0.080, time: "31min" },
  ],
};

function fmtUSD(n: number, compact = false) {
  if (compact && n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (compact && n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-bg-1 p-4">
      <div className="text-[10px] text-fg-3 font-mono uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-lg font-semibold font-mono ${accent ? "text-accent" : "text-fg"}`}>{value}</div>
      {sub && <div className="text-[11px] text-fg-3 mt-0.5">{sub}</div>}
    </div>
  );
}

function CapTableDonut({ segments }: { segments: typeof EQUITY_DATA.capTable }) {
  const cx = 70, cy = 70, r = 52, strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.20 0.006 240)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const offset = circumference * (1 - cumulative / 100);
        const dash = (seg.pct / 100) * circumference;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          />
        );
        cumulative += seg.pct;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="oklch(0.94 0.006 240)" fontSize="11" fontWeight="600" fontFamily="monospace">$CAPI</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="oklch(0.64 0.012 240)" fontSize="9" fontFamily="monospace">10M supply</text>
    </svg>
  );
}

// Fake sparkline for price chart
function PriceSparkline() {
  const points = [0.071, 0.073, 0.069, 0.074, 0.072, 0.076, 0.075, 0.079, 0.077, 0.081, 0.080, 0.082];
  const w = 300, h = 60;
  const min = Math.min(...points) - 0.002;
  const max = Math.max(...points) + 0.002;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map((p) => h - ((p - min) / (max - min)) * h);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.18 148)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.82 0.18 148)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkGrad)" />
      <path d={d} fill="none" stroke="oklch(0.82 0.18 148)" strokeWidth="1.5" />
    </svg>
  );
}

export default async function EquityStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const isDemo = isDemoUser(user.email);
  const d = EQUITY_DATA;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <div className="text-[10px] text-fg-3 font-mono tracking-wider uppercase mb-0.5">
            Equity Studio
          </div>
          <h1 className="text-lg font-semibold text-fg flex items-center gap-2">
            $CAPI Token
            <span className="text-xs font-mono bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">SPL · devnet</span>
          </h1>
        </div>
        {!isDemo && (
          <div className="text-xs text-fg-3 bg-bg-1 border border-line rounded-lg px-3 py-1.5 font-mono">
            Conecte sua wallet para ver posições reais
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Preço CAPI/USDC"
          value={`$${d.price.toFixed(3)}`}
          sub={`${d.priceChange24h > 0 ? "+" : ""}${d.priceChange24h}% 24h`}
          accent
        />
        <StatCard label="Market Cap" value={fmtUSD(d.marketCap, true)} sub={`${fmtTokens(d.circulating)} circulando`} />
        <StatCard label="TVL Pool" value={fmtUSD(d.pool.tvl, true)} sub={`${d.pool.pair} · ${d.pool.apr}% APR`} accent />
        <StatCard label="Dividendos" value={fmtUSD(d.dividends.totalDistributed, true)} sub={`próx. em ${d.dividends.nextInDays}d`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Price chart + recent trades */}
        <div className="lg:col-span-2 space-y-5">
          {/* Price chart */}
          <div className="rounded-xl border border-line bg-bg-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">Preço CAPI/USDC</div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-semibold text-accent">${d.price.toFixed(3)}</span>
                <span className="text-[10px] font-mono text-accent">+{d.priceChange24h}%</span>
              </div>
            </div>
            <PriceSparkline />
            <div className="flex justify-between text-[9px] font-mono text-fg-3 mt-1">
              <span>30 dias</span>
              <span>hoje</span>
            </div>
          </div>

          {/* LP Pool */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
              Pool de Liquidez — AMM 50/50
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Par",       value: d.pool.pair },
                { label: "TVL",       value: fmtUSD(d.pool.tvl, true) },
                { label: "APR",       value: `${d.pool.apr}%` },
                { label: "Vol. 24h",  value: fmtUSD(d.pool.volume24h, true) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] font-mono text-fg-3 mb-0.5">{label}</div>
                  <div className="text-sm font-mono text-fg">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-xs text-accent font-mono hover:bg-accent/10 transition-colors">
                + Adicionar liquidez
              </button>
              <button className="px-3 py-1.5 rounded-lg border border-line text-xs text-fg-2 font-mono hover:bg-bg-2 transition-colors">
                Retirar
              </button>
            </div>
          </div>

          {/* Recent trades */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
              Negociações recentes
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-left text-[10px] font-mono text-fg-3 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-2 text-right text-[10px] font-mono text-fg-3 uppercase tracking-wider">$CAPI</th>
                  <th className="px-4 py-2 text-right text-[10px] font-mono text-fg-3 uppercase tracking-wider">Preço</th>
                  <th className="px-4 py-2 text-right text-[10px] font-mono text-fg-3 uppercase tracking-wider">Há</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.recentTrades.map((t, i) => (
                  <tr key={i} className="hover:bg-bg-2 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`font-mono ${t.side === "buy" ? "text-accent" : "text-neg"}`}>
                        {t.side === "buy" ? "COMPRA" : "VENDA"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{t.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg-2">${t.price.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg-3">{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: cap table + dividends */}
        <div className="space-y-5">
          {/* Cap table */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
              Cap Table
            </div>
            <div className="p-4">
              <div className="flex justify-center mb-4">
                <CapTableDonut segments={d.capTable} />
              </div>
              <div className="space-y-2">
                {d.capTable.map((row) => (
                  <div key={row.holder} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs">
                        <span className="text-fg-2 truncate">{row.holder}</span>
                        <span className="font-mono text-fg ml-2 shrink-0">{row.pct}%</span>
                      </div>
                      <div className="text-[10px] font-mono text-fg-3">{fmtTokens(row.tokens)} CAPI</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dividends */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-[10px] font-mono text-fg-3 uppercase tracking-wider">
              Dividendos
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-fg-3">Total distribuído</span>
                <span className="text-xs font-mono text-fg">{fmtUSD(d.dividends.totalDistributed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-fg-3">Próxima distribuição</span>
                <span className="text-xs font-mono text-accent">{fmtUSD(d.dividends.nextAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-fg-3">Em</span>
                <span className="text-xs font-mono text-warn">{d.dividends.nextInDays} dias</span>
              </div>
              <div className="flex justify-between border-t border-line pt-3">
                <span className="text-xs text-fg-3">Por token</span>
                <span className="text-xs font-mono text-fg">${d.dividends.perToken.toFixed(4)}</span>
              </div>
              <button className="w-full mt-1 px-3 py-2 rounded-lg border border-accent/30 bg-accent/5 text-xs text-accent font-mono hover:bg-accent/10 transition-colors">
                Reivindicar dividendos →
              </button>
            </div>
          </div>

          {/* Compliance note */}
          <div className="rounded-xl border border-line bg-bg-1 p-4">
            <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-2">SMB Equity (CVM 588)</div>
            <div className="text-xs text-fg-2 leading-relaxed">
              Tokens de equity são emitidos conforme instrução CVM 588 para PMEs. Consulte seu assessor jurídico antes de distribuir a investidores não-qualificados.
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-[10px] font-mono text-fg-3">Estrutura em conformidade · última revisão 15/04/2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
