interface Bucket {
  id: string;
  kind: string;
  label: string | null;
  targetAmountCents: number;
  currency: string;
}

interface BucketCardProps {
  bucket: Bucket;
  balanceUsd?: number;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const KIND_COLORS: Record<string, string> = {
  operating: "bg-accent",
  payroll: "bg-blue-400",
  tax: "bg-amber-400",
  emergency: "bg-red-400",
  yield: "bg-purple-400",
  custom: "bg-fg-3",
};

export function BucketCard({ bucket, balanceUsd = 0 }: BucketCardProps) {
  const targetUsd = bucket.targetAmountCents / 100;
  const fillPct = targetUsd > 0 ? Math.min((balanceUsd / targetUsd) * 100, 100) : 0;
  const barColor = KIND_COLORS[bucket.kind] ?? KIND_COLORS.custom;

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-sm font-medium text-fg">{bucket.label ?? bucket.kind}</span>
            <span className="ml-2 text-xs text-fg-3 font-mono">{bucket.kind}</span>
          </div>
          <div className="text-sm font-mono text-fg-1 shrink-0 ml-4">
            {targetUsd > 0 ? (
              <>
                <span className="text-fg">{fmtUSD(balanceUsd)}</span>
                <span className="text-fg-3"> / {fmtUSD(targetUsd)}</span>
              </>
            ) : (
              <span className="text-fg-3">sem alvo</span>
            )}
          </div>
        </div>
        {targetUsd > 0 && (
          <div className="h-1.5 rounded-full bg-bg-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
