import { getTranslations } from "next-intl/server";
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

export async function KpiGrid({ totalUsd, liquidUsd, projection, policyVersion }: KpiGridProps) {
  const t = await getTranslations("dashboard.kpi");
  const p = projection;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Row 1 */}
      <KpiCard
        label={t("total" as never)}
        value={totalUsd !== null ? fmtUSD(totalUsd) : "—"}
        sub="USDC · devnet"
      />
      <KpiCard
        label={t("liquid_runway" as never)}
        value={p ? `${p.liquidRunwayMonths.toFixed(1)} mo` : "—"}
        sub={liquidUsd !== null ? `${fmtUSD(liquidUsd, true)} ${t("available" as never)}` : t("no_snapshot_short" as never)}
        accent={!!p && p.liquidRunwayMonths >= 6}
        warn={!!p && p.liquidRunwayMonths >= 3 && p.liquidRunwayMonths < 6}
        neg={!!p && p.liquidRunwayMonths < 3}
      />
      <KpiCard
        label={t("protected_runway" as never)}
        value={p ? `${p.protectedRunwayMonths.toFixed(1)} mo` : "—"}
        sub={t("reserve_payroll" as never)}
        accent={!!p && p.protectedRunwayMonths >= 3}
        warn={!!p && p.protectedRunwayMonths < 3}
      />
      <KpiCard
        label={t("capital_deployed" as never)}
        value={p ? fmtUSD(p.deployedCapitalUsd) : "—"}
        sub={p ? `${p.deployedPct.toFixed(1)}% · ${p.blendedAprPct.toFixed(2)}% APR` : ""}
        badge={p ? `${p.deployedPct.toFixed(0)}%` : undefined}
        accent
      />

      {/* Row 2 */}
      <KpiCard
        label={t("yield_est" as never)}
        value={p ? fmtUSD(p.estimatedYieldYearUsd, true) : "—"}
        sub={t("per_year" as never)}
        accent
      />
      <KpiCard
        label={t("upcoming_obligations" as never)}
        value={p ? fmtUSD(p.upcomingObligations30dUsd, true) : "—"}
        sub={t("in_30_days" as never)}
        warn={!!p && p.upcomingObligations30dUsd > 0}
      />
      <KpiCard
        label={t("compliance" as never)}
        value={p ? `${p.topConcentrationPct.toFixed(0)}%` : "—"}
        sub={p?.topConcentrationProtocol ?? t("top_protocol" as never)}
        warn={!!p && p.topConcentrationPct > 45}
        accent={!!p && p.topConcentrationPct <= 45}
      />
      <KpiCard
        label={t("compliance" as never)}
        value={p ? `${p.complianceScore}/100` : "—"}
        sub={policyVersion !== null ? t("policy_version" as never, { version: policyVersion } as never) : t("no_policy" as never)}
        accent={!!p && p.complianceScore >= 80}
        warn={!!p && p.complianceScore >= 60 && p.complianceScore < 80}
        neg={!!p && p.complianceScore < 60}
      />
    </div>
  );
}
