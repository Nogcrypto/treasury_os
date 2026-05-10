import type { TreasurySnapshot } from "@/lib/rules-engine/types";

type Position = TreasurySnapshot["positions"][number];

interface PositionsTableProps {
  positions: Position[];
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

const RISK_LABEL: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };
const RISK_CLASS: Record<number, string> = {
  1: "text-accent bg-accent/10 border-accent/20",
  2: "text-warn bg-warn/10 border-warn/20",
  3: "text-neg bg-neg/10 border-neg/20",
};

const STRATEGY_LABEL: Record<string, string> = {
  "kamino-usdc-devnet": "Lending",
  "mock-rwa-usdy": "T-Bills",
};

export function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-fg-3 font-mono">
        Nenhuma posição alocada
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {[
              { label: "Protocolo",  align: "left" },
              { label: "Estratégia", align: "left" },
              { label: "Ativo",      align: "left" },
              { label: "Valor",      align: "right" },
              { label: "APR",        align: "right" },
              { label: "Yield acum.", align: "right" },
              { label: "Risco",      align: "right" },
              { label: "Dias",       align: "right" },
            ].map((h) => (
              <th
                key={h.label}
                className={`px-4 py-2 text-[10px] font-mono text-fg-3 uppercase tracking-wider ${h.align === "right" ? "text-right" : "text-left"}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {positions.map((p) => (
            <tr key={p.adapterId} className="hover:bg-bg-2 transition-colors">
              <td className="px-4 py-3 text-fg font-medium">{p.protocol}</td>
              <td className="px-4 py-3">
                <span className="text-xs font-mono text-fg-2 bg-bg-2 px-2 py-0.5 rounded border border-line">
                  {STRATEGY_LABEL[p.adapterId] ?? "Outro"}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-fg-2 text-xs">{p.asset}</td>
              <td className="px-4 py-3 text-right font-mono text-fg">{fmtUSD(p.amountUsd)}</td>
              <td className="px-4 py-3 text-right font-mono text-accent text-xs">{p.aprPct.toFixed(2)}%</td>
              <td className="px-4 py-3 text-right font-mono text-fg-2 text-xs">
                {p.accruedYieldUsd > 0 ? fmtUSD(p.accruedYieldUsd) : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${RISK_CLASS[p.riskTier] ?? "text-fg-3"}`}>
                  {RISK_LABEL[p.riskTier] ?? `T${p.riskTier}`}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-fg-3 text-xs">
                {p.unlockDays === 0 ? "0d" : `${p.unlockDays}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
