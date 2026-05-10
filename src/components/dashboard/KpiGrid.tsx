import type { ProjectionResult } from "@/lib/rules-engine/types";

interface KpiGridProps {
  totalUsd: number | null;
  liquidUsd: number | null;
  projection: ProjectionResult | null;
  policyVersion: number | null;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const valueClass = accent ? "text-accent" : warn ? "text-warn" : "text-fg";

  return (
    <div className="rounded-xl border border-line bg-bg-1 p-4">
      <div className="text-xs text-fg-3 font-mono uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-xl font-semibold font-mono ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-fg-3 mt-1">{sub}</div>}
    </div>
  );
}

export function KpiGrid({ totalUsd, liquidUsd, projection, policyVersion }: KpiGridProps) {
  const blendedApr = projection?.blendedAprPct ?? null;
  const score = projection?.complianceScore ?? null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Total treasury"
        value={totalUsd !== null ? fmtUSD(totalUsd) : "—"}
        sub="USDC"
      />
      <KpiCard
        label="Liquid"
        value={liquidUsd !== null ? fmtUSD(liquidUsd) : "—"}
        sub={
          projection
            ? `${projection.liquidRunwayMonths.toFixed(1)} mo runway`
            : "estimado"
        }
      />
      <KpiCard
        label="Deployed"
        value={projection ? fmtUSD(projection.deployedCapitalUsd) : "—"}
        sub={
          blendedApr !== null
            ? `${projection!.deployedPct.toFixed(1)}% · ${blendedApr.toFixed(2)}% APR`
            : ""
        }
        accent
      />
      <KpiCard
        label="Compliance"
        value={score !== null ? `${score}/100` : "—"}
        sub={policyVersion !== null ? `política v${policyVersion}` : "sem política"}
        warn={score !== null && score < 70}
      />
    </div>
  );
}
