import type { ProjectionResult } from "@/lib/rules-engine/types";

interface KpiGridProps {
  totalUsd: number | null;
  liquidUsd: number | null;
  projection: ProjectionResult | null;
  policyVersion: number | null;
}

function fmtUSD(n: number, compact = false) {
  if (compact && n >= 1_000_000)
    return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (compact && n >= 1_000)
    return "$" + (n / 1_000).toFixed(1) + "k";
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
  badge,
  accent,
  warn,
  neg,
  dim,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  accent?: boolean;
  warn?: boolean;
  neg?: boolean;
  dim?: boolean;
}) {
  const valueClass = accent ? "text-accent" : warn ? "text-warn" : neg ? "text-neg" : dim ? "text-fg-2" : "text-fg";

  return (
    <div className="rounded-xl border border-line bg-bg-1 p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-fg-3 font-mono uppercase tracking-wider">{label}</div>
        {badge && (
          <span className="text-[9px] font-mono bg-bg-2 text-fg-3 px-1.5 py-0.5 rounded-full border border-line">{badge}</span>
        )}
      </div>
      <div className={`text-lg font-semibold font-mono leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-fg-3 leading-tight">{sub}</div>}
    </div>
  );
}

export function KpiGrid({ totalUsd, liquidUsd, projection, policyVersion }: KpiGridProps) {
  const p = projection;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Row 1 */}
      <KpiCard
        label="Total Treasury"
        value={totalUsd !== null ? fmtUSD(totalUsd) : "—"}
        sub="USDC · devnet"
      />
      <KpiCard
        label="Liquid Runway"
        value={p ? `${p.liquidRunwayMonths.toFixed(1)} mo` : "—"}
        sub={liquidUsd !== null ? `${fmtUSD(liquidUsd, true)} disponível` : "sem snapshot"}
        accent={!!p && p.liquidRunwayMonths >= 6}
        warn={!!p && p.liquidRunwayMonths >= 3 && p.liquidRunwayMonths < 6}
        neg={!!p && p.liquidRunwayMonths < 3}
      />
      <KpiCard
        label="Runway protegido"
        value={p ? `${p.protectedRunwayMonths.toFixed(1)} mo` : "—"}
        sub="Reserva + Folha"
        accent={!!p && p.protectedRunwayMonths >= 3}
        warn={!!p && p.protectedRunwayMonths < 3}
      />
      <KpiCard
        label="Capital Deployed"
        value={p ? fmtUSD(p.deployedCapitalUsd) : "—"}
        sub={p ? `${p.deployedPct.toFixed(1)}% · ${p.blendedAprPct.toFixed(2)}% APR` : ""}
        badge={p ? `${p.deployedPct.toFixed(0)}%` : undefined}
        accent
      />

      {/* Row 2 */}
      <KpiCard
        label="Yield estimado"
        value={p ? fmtUSD(p.estimatedYieldYearUsd, true) : "—"}
        sub="por ano"
        accent
      />
      <KpiCard
        label="Próximas obrig."
        value={p ? fmtUSD(p.upcomingObligations30dUsd, true) : "—"}
        sub="em 30 dias"
        warn={!!p && p.upcomingObligations30dUsd > 0}
      />
      <KpiCard
        label="Concentração"
        value={p ? `${p.topConcentrationPct.toFixed(0)}%` : "—"}
        sub={p?.topConcentrationProtocol ?? "top protocolo"}
        warn={!!p && p.topConcentrationPct > 45}
        accent={!!p && p.topConcentrationPct <= 45}
      />
      <KpiCard
        label="Compliance"
        value={p ? `${p.complianceScore}/100` : "—"}
        sub={policyVersion !== null ? `política v${policyVersion}` : "sem política"}
        accent={!!p && p.complianceScore >= 80}
        warn={!!p && p.complianceScore >= 60 && p.complianceScore < 80}
        neg={!!p && p.complianceScore < 60}
      />
    </div>
  );
}
