"use client";

interface ConcentrationPanelProps {
  totalUsd: number;
  liquidUsd: number;
  positions: { adapterId: string; amountUsd: number; protocol: string }[];
  complianceScore: number;
  policyVersion?: number | null;
  concentrationLimit?: number | null;
}

const SEGMENT_COLORS: Record<string, string> = {
  "kamino-usdc-devnet": "oklch(0.78 0.13 200)",
  "mock-rwa-usdy":      "oklch(0.74 0.18 295)",
  liquid:               "oklch(0.82 0.18 148)",
};

const SEGMENT_LABELS: Record<string, string> = {
  "kamino-usdc-devnet": "Kamino USDC",
  "mock-rwa-usdy":      "Mock RWA",
  liquid:               "USDC livre",
};

function fmtUSD(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

function DonutChart({
  slices,
  totalUsd,
}: {
  slices: { pct: number; color: string }[];
  totalUsd: number;
}) {
  let cumulative = 0;
  const cx = 56, cy = 56, r = 40, strokeWidth = 14;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="oklch(0.20 0.006 240)"
        strokeWidth={strokeWidth}
      />
      {slices.map((slice, i) => {
        const offset = circumference * (1 - cumulative / 100);
        const dash = (slice.pct / 100) * circumference;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: "56px 56px" }}
          />
        );
        cumulative += slice.pct;
        return el;
      })}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        fill="oklch(0.90 0.012 240)"
        fontSize="11"
        fontWeight="600"
        fontFamily="monospace"
      >
        {fmtUSD(totalUsd)}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle"
        fill="oklch(0.48 0.012 240)"
        fontSize="8"
        fontFamily="monospace"
      >
        total
      </text>
    </svg>
  );
}

function ComplianceGauge({ score }: { score: number }) {
  const r = 36;
  const cx = 52, cy = 50;
  const scoreColor =
    score >= 80 ? "oklch(0.82 0.18 148)"
    : score >= 60 ? "oklch(0.82 0.16 80)"
    : "oklch(0.68 0.22 25)";

  const describeArc = (startRad: number, endRad: number) => {
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  const bgPath = describeArc(Math.PI, 0);
  const fillEnd = Math.PI + (score / 100) * Math.PI;
  const fillPath = describeArc(Math.PI, fillEnd);

  return (
    <svg width="104" height="64" viewBox="0 0 104 64">
      <path d={bgPath} fill="none" stroke="oklch(0.20 0.006 240)" strokeWidth="12" strokeLinecap="round" />
      {score > 0 && (
        <path d={fillPath} fill="none" stroke={scoreColor} strokeWidth="12" strokeLinecap="round" />
      )}
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        fill={scoreColor}
        fontSize="18"
        fontWeight="600"
        fontFamily="monospace"
      >
        {score}
      </text>
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        fill="oklch(0.48 0.012 240)"
        fontSize="8"
        fontFamily="monospace"
      >
        /100
      </text>
    </svg>
  );
}

export function ConcentrationPanel({
  totalUsd,
  liquidUsd,
  positions,
  complianceScore,
  policyVersion,
  concentrationLimit,
}: ConcentrationPanelProps) {
  const allSlices = [
    { key: "liquid", amount: liquidUsd },
    ...positions.map((p) => ({ key: p.adapterId, amount: p.amountUsd })),
  ];
  const total = allSlices.reduce((s, x) => s + x.amount, 0) || 1;
  const slices = allSlices.map((s) => ({
    pct: (s.amount / total) * 100,
    color: SEGMENT_COLORS[s.key] ?? "oklch(0.48 0.012 240)",
    label: SEGMENT_LABELS[s.key] ?? s.key,
    amount: s.amount,
  }));

  return (
    <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-fg-3">◎</span>
          <span className="text-xs font-medium text-fg">Concentração</span>
        </div>
        {concentrationLimit != null && (
          <span className="text-[10px] font-mono text-fg-3">LIMITE {concentrationLimit}%</span>
        )}
      </div>

      {/* Donut + Legend */}
      <div className="p-4 flex gap-4 items-start">
        <div className="shrink-0">
          <DonutChart slices={slices} totalUsd={totalUsd} />
        </div>
        <div className="flex-1 min-w-0 space-y-2.5 pt-1">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="flex-1 text-xs text-fg-2 min-w-0">{s.label}</span>
              <span className="text-[11px] font-mono text-fg-3 shrink-0">
                {fmtUSD(s.amount)}
              </span>
              <span className="text-[11px] font-mono text-fg shrink-0 w-10 text-right">
                {s.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance */}
      <div className="px-4 pb-4 border-t border-line pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-fg-3 uppercase tracking-wider">
            Compliance Score
          </span>
          <span className="text-[10px] font-mono text-fg-3">
            política v{policyVersion ?? 1}
          </span>
        </div>
        <div className="flex items-center justify-center">
          <ComplianceGauge score={complianceScore} />
        </div>
      </div>
    </div>
  );
}
