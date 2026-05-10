interface ConcentrationPanelProps {
  totalUsd: number;
  liquidUsd: number;
  positions: { adapterId: string; amountUsd: number; protocol: string }[];
  complianceScore: number;
}

const SEGMENT_COLORS: Record<string, string> = {
  "kamino-usdc-devnet": "oklch(0.78 0.13 200)",
  "mock-rwa-usdy": "oklch(0.74 0.18 295)",
  liquid: "oklch(0.82 0.18 148)",
};

const SEGMENT_LABELS: Record<string, string> = {
  "kamino-usdc-devnet": "Kamino",
  "mock-rwa-usdy": "RWA (USDY)",
  liquid: "USDC livre",
};

function DonutChart({ slices }: { slices: { pct: number; color: string; label: string }[] }) {
  let cumulative = 0;
  const cx = 60, cy = 60, r = 44, strokeWidth = 16;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.20 0.006 240)" strokeWidth={strokeWidth} />
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
            style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px" }}
          />
        );
        cumulative += slice.pct;
        return el;
      })}
    </svg>
  );
}

function ComplianceGauge({ score }: { score: number }) {
  const r = 40;
  const cx = 60, cy = 58;
  const arcLength = Math.PI * r;
  const filled = (score / 100) * arcLength;
  const scoreColor = score >= 80 ? "oklch(0.82 0.18 148)" : score >= 60 ? "oklch(0.82 0.16 80)" : "oklch(0.68 0.22 25)";

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
    <svg width="120" height="74" viewBox="0 0 120 74">
      <path d={bgPath} fill="none" stroke="oklch(0.20 0.006 240)" strokeWidth="14" strokeLinecap="round" />
      {score > 0 && (
        <path d={fillPath} fill="none" stroke={scoreColor} strokeWidth="14" strokeLinecap="round" />
      )}
      <text x={cx} y={cy + 10} textAnchor="middle" fill={scoreColor} fontSize="18" fontWeight="600" fontFamily="monospace">
        {score}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="oklch(0.48 0.012 240)" fontSize="9" fontFamily="monospace">
        /100
      </text>
    </svg>
  );
}

export function ConcentrationPanel({ totalUsd, liquidUsd, positions, complianceScore }: ConcentrationPanelProps) {
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
      <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
        Concentração & Compliance
      </div>
      <div className="p-4 flex items-center gap-6">
        {/* Donut */}
        <div className="shrink-0">
          <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-2 text-center">Alocação</div>
          <DonutChart slices={slices} />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 min-w-0">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-2 truncate">{s.label}</span>
                  <span className="font-mono text-fg shrink-0 ml-2">{s.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-bg-2 rounded-full mt-0.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance gauge */}
        <div className="shrink-0 text-center">
          <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-1">Compliance</div>
          <ComplianceGauge score={complianceScore} />
          <div className="text-[10px] font-mono text-fg-3">política v3</div>
        </div>
      </div>
    </div>
  );
}
