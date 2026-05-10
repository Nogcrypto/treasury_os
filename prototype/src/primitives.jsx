/* primitives — small reusable bits */

const Icon = ({ name, size = 14, stroke = 1.6, ...rest }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    cmd: <><path d="M9 6h6m0 12H9M6 9V6m0 9v3m12-9V6m0 9v3"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    moon: <path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    home: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></>,
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    flask: <><path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3"/><path d="M8 3h8"/></>,
    arrowRight: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    arrowDown: <path d="M12 5v14m-5-5 5 5 5-5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m4 12 5 5L20 6"/>,
    x: <path d="M5 5l14 14M19 5 5 19"/>,
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    chevronRight: <path d="m9 6 6 6-6 6"/>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 14h2"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>,
    cycle: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 20v-4h4"/></>,
    coins: <><circle cx="9" cy="9" r="6"/><path d="M16.5 9c2.5.4 4.5 2.5 4.5 5.5 0 3-2.5 5.5-5.5 5.5-3 0-5.1-2-5.5-4.5"/></>,
    wand: <><path d="m4 20 12-12"/><path d="M16 4h4v4"/><path d="m13 7 3 3"/></>,
    list: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></>,
    bell2: <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/>,
    radio: <><circle cx="12" cy="12" r="3"/><path d="M16.2 7.8a6 6 0 0 1 0 8.5M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.5M4.9 19.1a10 10 0 0 1 0-14.2"/></>,
    paperclip: <path d="M21 12 12.8 20.2a5 5 0 0 1-7-7L14 5a3.5 3.5 0 1 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Z"/></>,
    droplet: <path d="M12 3 6 11a8 8 0 1 0 12 0L12 3Z"/>,
    fire: <path d="M12 22a7 7 0 0 1-7-7c0-3 2-5 3-7 1 2 3 2 3 0V3c0 4 6 6 6 12a7 7 0 0 1-5 7Z"/>,
    layers2: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    play: <path d="m6 4 14 8-14 8V4Z"/>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    bank: <><path d="M3 21h18M5 10h14M4 21V10M20 21V10M5 10 12 4l7 6"/><path d="M8 21v-7M12 21v-7M16 21v-7"/></>,
    feather: <><path d="M20 4c0 7-7 14-14 14H3v-3c0-7 7-14 14-14h3v3Z"/><path d="M16 8 2 22"/><path d="M9 15h7"/></>,
    pulse: <path d="M3 12h4l3-9 4 18 3-9h4"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    upload: <><path d="M12 3v14"/><path d="m6 9 6-6 6 6"/><path d="M3 21h18"/></>,
    download: <><path d="M12 3v14"/><path d="m6 13 6 6 6-6"/><path d="M3 21h18"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );
};

const Sparkline = ({ kind = "up", w = 64, h = 22 }) => {
  const points = {
    up:   [4, 18, 8, 14, 14, 17, 20, 12, 28, 14, 36, 9, 44, 11, 52, 5, 60, 7],
    flat: [4, 12, 12, 13, 20, 11, 28, 13, 36, 12, 44, 14, 52, 11, 60, 13],
    down: [4, 6,  8, 9,  14, 8,  20, 12, 28, 11, 36, 14, 44, 13, 52, 16, 60, 17],
  };
  const arr = points[kind];
  const pts = [];
  for (let i = 0; i < arr.length; i += 2) pts.push(`${arr[i]},${arr[i+1]}`);
  const color = kind === "down" ? "var(--neg)" : kind === "flat" ? "var(--fg-3)" : "var(--pos)";
  return (
    <svg className="sparkline" viewBox={`0 0 64 22`} width={w} height={h}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const Donut = ({ data, size = 132, hole = 0.6 }) => {
  const total = data.reduce((s, d) => s + d.pct, 0);
  let acc = 0;
  const r = size / 2;
  const rIn = r * hole;
  const cx = r, cy = r;
  return (
    <svg className="donut-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {data.map((d, i) => {
        const start = (acc / total) * 2 * Math.PI - Math.PI / 2;
        acc += d.pct;
        const end = (acc / total) * 2 * Math.PI - Math.PI / 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
        const x3 = cx + rIn * Math.cos(end), y3 = cy + rIn * Math.sin(end);
        const x4 = cx + rIn * Math.cos(start), y4 = cy + rIn * Math.sin(start);
        const dPath = [
          `M ${x1} ${y1}`,
          `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4}`,
          "Z"
        ].join(" ");
        return <path key={i} d={dPath} fill={d.color} stroke="var(--bg-1)" strokeWidth="1" />;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600"
            fontSize="14" fill="var(--fg)">${(data.reduce((s,d) => s + d.v, 0) / 1000).toFixed(0)}k</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="JetBrains Mono"
            fontSize="9" fill="var(--fg-3)" letterSpacing="0.08em">TOTAL</text>
    </svg>
  );
};

const Gauge = ({ value = 94, max = 100 }) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 80" width="110" height="80">
      <path d={`M 15 65 A ${r} ${r} 0 1 1 95 65`} fill="none" stroke="var(--bg-3)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M 15 65 A ${r} ${r} 0 1 1 95 65`} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (value / max) * (c * 0.75)} />
    </svg>
  );
};

const Toggle = ({ on, onClick }) => (
  <div className={"toggle" + (on ? " on" : "")} onClick={onClick} role="button" />
);

const TickerTape = ({ items }) => {
  const reel = [...items, ...items];
  return (
    <div className="ticker">
      <div className="label">▌ DEVNET LIVE · {new Date().toUTCString().slice(17, 22)} UTC</div>
      <div className="reel">
        {reel.map((it, i) => (
          <span className="item" key={i}>
            <span className="sym">{it.sym}</span>
            <span>{it.v}</span>
            <span className={it.pos ? "pos" : "neg"} style={{marginLeft: 6}}>{it.d}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const Brand = () => (
  <div className="brand">
    <div className="brand-mark" aria-hidden="true"></div>
    <span>TreasuryOS</span>
    <span className="v">v0.4 · DEVNET</span>
  </div>
);

const ModeBadge = ({ simulated }) => (
  simulated
    ? <span className="mode-banner sim">◉ SIMULATED MODE</span>
    : <span className="mode-banner live"><span className="dot pulse" style={{background: "var(--pos)"}}></span> DEVNET LIVE</span>
);

const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n) => "$" + fmt(n);
const fmtPct = (n, d = 1) => fmt(n, d) + "%";

Object.assign(window, { Icon, Sparkline, Donut, Gauge, Toggle, TickerTape, Brand, ModeBadge, fmt, fmtUSD, fmtPct });
