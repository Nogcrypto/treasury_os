"use client";

const ITEMS = [
  { label: "USDC/USD",    value: "$1.000",   change: null,    changeClass: "" },
  { label: "SOL/USD",     value: "$148.32",  change: "+2.4%", changeClass: "text-accent" },
  { label: "JTO",         value: "$2.81",    change: "+1.2%", changeClass: "text-accent" },
  { label: "KAMINO APR",  value: "5.84%",    change: null,    changeClass: "" },
  { label: "USDY APR",    value: "4.82%",    change: null,    changeClass: "" },
  { label: "SOL TPS",     value: "3,241",    change: null,    changeClass: "" },
  { label: "BR-CDI",      value: "13.75%",   change: null,    changeClass: "" },
  { label: "CAPI/USDC",   value: "$0.082",   change: "+5.3%", changeClass: "text-accent" },
  { label: "TVL POOL",    value: "$1.2M",    change: null,    changeClass: "" },
  { label: "TREASURY",    value: "$812,440", change: null,    changeClass: "" },
  { label: "RUNWAY",      value: "6.8 mo",   change: null,    changeClass: "" },
];

function TickerItem({ label, value, change, changeClass }: typeof ITEMS[number]) {
  return (
    <span className="inline-flex items-center gap-1.5 px-4 shrink-0">
      <span className="text-fg-3 font-mono text-[10px] uppercase tracking-wider">{label}</span>
      <span className="text-fg font-mono text-xs font-medium">{value}</span>
      {change && <span className={`font-mono text-[10px] ${changeClass}`}>{change}</span>}
      <span className="text-line ml-3">|</span>
    </span>
  );
}

export function MarketTicker() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div className="h-8 border-b border-line bg-bg-1 overflow-hidden flex items-center">
      <div className="animate-marquee flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <TickerItem key={i} {...item} />
        ))}
      </div>
    </div>
  );
}
