/* Shell — sidebar + topbar + ticker + main router */

const NAV = [
  { id: "dashboard",  label: "Dashboard",     icon: "home" },
  { id: "policy",     label: "Policy Engine", icon: "shield" },
  { id: "copilot",    label: "AI Copilot",    icon: "sparkles", badge: "3" },
  { id: "simulator",  label: "Simulador",     icon: "flask" },
  { id: "execution",  label: "Execução",      icon: "bolt" },
  { id: "tokenstudio",label: "Equity Studio", icon: "coins", tag: "NOVO" },
];

const NAV_SECONDARY = [
  { id: "buckets",    label: "Buckets",       icon: "layers2" },
  { id: "reports",    label: "Reporting",     icon: "file" },
  { id: "alerts",     label: "Alertas",       icon: "bell2", badge: "2", alert: true },
];

const Sidebar = ({ active, setActive, simulated, setSimulated }) => {
  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="h">Workspace</div>
        {NAV.map(it => (
          <div key={it.id}
               className={"side-item" + (active === it.id ? " active" : "")}
               onClick={() => setActive(it.id)}>
            <Icon name={it.icon} size={14} />
            <span>{it.label}</span>
            {it.badge && <span className="badge">{it.badge}</span>}
            {it.tag && <span className="tag cyan" style={{marginLeft: "auto", fontSize: 9, padding: "1px 5px"}}>{it.tag}</span>}
          </div>
        ))}
      </div>

      <div className="side-section">
        <div className="h">Operações</div>
        {NAV_SECONDARY.map(it => (
          <div key={it.id}
               className={"side-item" + (active === it.id ? " active" : "")}
               onClick={() => setActive(it.id)}>
            <Icon name={it.icon} size={14} />
            <span>{it.label}</span>
            {it.badge && <span className={"badge" + (it.alert ? " alert" : "")}>{it.badge}</span>}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <div className="org-chip">
          <div className="org-avatar">CL</div>
          <div className="meta">
            <div className="name">{TOS.ORG.name}</div>
            <div className="sub">{TOS.ORG.wallet}</div>
          </div>
          <Icon name="chevronDown" size={12} />
        </div>
        <div style={{padding: "8px 6px 2px", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <span className="mono-sm">Modo</span>
          <div className="row gap-s">
            <span style={{fontSize: 11, color: simulated ? "var(--fg-3)" : "var(--pos)", fontFamily: "JetBrains Mono"}}>LIVE</span>
            <Toggle on={simulated} onClick={() => setSimulated(!simulated)} />
            <span style={{fontSize: 11, color: simulated ? "var(--accent-3)" : "var(--fg-3)", fontFamily: "JetBrains Mono"}}>SIM</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ theme, toggleTheme, simulated, onCmdK, onConnect, onStartTour }) => {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-search" style={{marginLeft: 24}}>
        <Icon name="search" size={13} />
        <input placeholder="Buscar policy, intent, txhash, holder…" />
        <span className="kbd">⌘K</span>
      </div>
      <div className="topbar-actions">
        <ModeBadge simulated={simulated} />
        <button className="btn" onClick={onStartTour} title="Tour guiado pela plataforma">
          <Icon name="sparkles" size={12} />
          <span>Tour</span>
        </button>
        <button className="btn icon" title="Toggle theme" onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
        </button>
        <button className="btn ghost icon" title="Notificações">
          <Icon name="bell" size={14} />
        </button>
        <button className="btn">
          <Icon name="radio" size={12} />
          <span className="mono">RPC FAST · 12ms</span>
        </button>
        <button className="phantom-glow" onClick={onConnect}>
          <span className="phantom-icon">P</span>
          <span>{TOS.ORG.wallet}</span>
        </button>
      </div>
    </header>
  );
};

const PageHead = ({ crumb, title, desc, actions }) => (
  <div className="page-head">
    <div>
      <div className="crumb">{crumb}</div>
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
    {actions && <div className="actions">{actions}</div>}
  </div>
);

Object.assign(window, { Sidebar, TopBar, PageHead, NAV, NAV_SECONDARY });
