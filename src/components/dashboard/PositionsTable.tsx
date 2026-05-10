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

const RISK_LABEL: Record<number, string> = { 1: "baixo", 2: "médio", 3: "alto" };
const RISK_CLASS: Record<number, string> = {
  1: "text-accent",
  2: "text-warn",
  3: "text-neg",
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
            {["Protocolo", "Ativo", "Valor", "APR", "Yield acum.", "Risco", "Unlock"].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2 text-xs font-mono text-fg-3 uppercase tracking-wider ${i < 2 ? "text-left" : "text-right"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {positions.map((p) => (
            <tr key={p.adapterId} className="hover:bg-bg-2 transition-colors">
              <td className="px-4 py-3 text-fg font-medium">{p.protocol}</td>
              <td className="px-4 py-3 font-mono text-fg-2">{p.asset}</td>
              <td className="px-4 py-3 text-right font-mono text-fg">{fmtUSD(p.amountUsd)}</td>
              <td className="px-4 py-3 text-right font-mono text-accent">{p.aprPct.toFixed(2)}%</td>
              <td className="px-4 py-3 text-right font-mono text-fg-2">
                {p.accruedYieldUsd > 0 ? fmtUSD(p.accruedYieldUsd) : "—"}
              </td>
              <td className={`px-4 py-3 text-right font-mono text-xs ${RISK_CLASS[p.riskTier] ?? "text-fg-3"}`}>
                {RISK_LABEL[p.riskTier] ?? p.riskTier}
              </td>
              <td className="px-4 py-3 text-right font-mono text-fg-3 text-xs">
                {p.unlockDays === 0 ? "imediato" : `${p.unlockDays}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
