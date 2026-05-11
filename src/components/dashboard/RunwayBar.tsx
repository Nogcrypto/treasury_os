import { getTranslations } from "next-intl/server";

const MONTHLY_BURN = 72_418;

interface RunwayBarProps {
  liquidUsd: number;
  deployedUsd: number;
  totalUsd: number;
  buckets?: { kind: string; balanceUsd: number }[];
}

const BUCKET_CONFIG = [
  { kind: "operating", color: "bg-accent",   textColor: "text-accent",   labelKey: "operating" },
  { kind: "payroll",   color: "bg-accent-2", textColor: "text-accent-2", labelKey: "payroll" },
  { kind: "tax",       color: "bg-warn",     textColor: "text-warn",     labelKey: "tax" },
  { kind: "emergency", color: "bg-neg",      textColor: "text-neg",      labelKey: "emergency" },
  { kind: "yield",     color: "bg-accent-3", textColor: "text-accent-3", labelKey: "yield" },
];

const MAX_MONTHS = 12;

export async function RunwayBar({ liquidUsd, deployedUsd: _deployedUsd, totalUsd, buckets }: RunwayBarProps) {
  const t = await getTranslations("dashboard.runway");
  const tBuckets = await getTranslations("dashboard.buckets");

  const totalMonths = totalUsd / MONTHLY_BURN;
  const displayMax = Math.max(MAX_MONTHS, Math.ceil(totalMonths));

  const segments = BUCKET_CONFIG.map((cfg) => {
    const bucket = buckets?.find((b) => b.kind === cfg.kind);
    const balanceUsd = bucket?.balanceUsd ?? 0;
    const months = balanceUsd / MONTHLY_BURN;
    const widthPct = (months / displayMax) * 100;
    const label = tBuckets(cfg.labelKey as never);
    return { ...cfg, label, months, widthPct, balanceUsd };
  }).filter((s) => s.balanceUsd > 0);

  const liquidMonths = liquidUsd / MONTHLY_BURN;
  const protectedMonths = 4.0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-fg-3 uppercase tracking-wider">
          {t("title" as never)}
        </div>
        <div className="flex items-center gap-3">
          {BUCKET_CONFIG.slice(0, 4).map((cfg) => (
            <div key={cfg.kind} className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
              <span className="text-[10px] text-fg-3">{tBuckets(cfg.labelKey as never)}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-3" />
            <span className="text-[10px] text-fg-3">{tBuckets("yield" as never)}</span>
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-7 rounded-lg overflow-hidden bg-bg-2 flex">
        {segments.map((seg) => (
          <div
            key={seg.kind}
            style={{ width: `${seg.widthPct}%` }}
            className={`${seg.color} opacity-80 hover:opacity-100 transition-opacity relative group`}
            title={`${seg.label}: ${seg.months.toFixed(1)} mo`}
          />
        ))}
        {/* Protected runway marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-bg-0/60 z-10"
          style={{ left: `${(protectedMonths / displayMax) * 100}%` }}
        />
        <div
          className="absolute -top-0.5 text-[9px] font-mono text-fg-2 translate-x-1"
          style={{ left: `${(protectedMonths / displayMax) * 100}%` }}
        >
          {t("protected_marker" as never)}
        </div>
      </div>

      {/* X-axis */}
      <div className="relative h-4 mt-1">
        {[0, 3, 6, 9, 12].filter((m) => m <= displayMax).map((m) => (
          <div
            key={m}
            className="absolute text-[10px] font-mono text-fg-3 -translate-x-1/2"
            style={{ left: `${(m / displayMax) * 100}%` }}
          >
            {m === 0 ? t("today" as never) : `${m}m`}
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-2 text-xs">
        <span className="text-fg-3">
          {t("liquid" as never)} <span className="font-mono text-fg">{liquidMonths.toFixed(1)} mo</span>
        </span>
        <span className="text-fg-3">
          {t("total" as never)} <span className="font-mono text-fg">{(totalUsd / MONTHLY_BURN).toFixed(1)} mo</span>
        </span>
        <span className="text-fg-3">
          {t("burn" as never)} <span className="font-mono text-fg">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(MONTHLY_BURN)}
          </span>
        </span>
      </div>
    </div>
  );
}
