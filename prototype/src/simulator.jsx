/* Simulator */

const Simulator = ({ onApprove }) => {
  const [kamino, setKamino] = React.useState(250);
  const [rwa, setRwa] = React.useState(70);
  const [sol, setSol] = React.useState(0);

  const totalAlloc = kamino + rwa + sol;
  const baseTotal = 812;
  const baseLiquid = 492;
  const newLiquid = baseLiquid - totalAlloc;
  const apr = totalAlloc > 0 ? ((kamino * 5.84 + rwa * 4.82 + sol * 7.2) / totalAlloc) : 0;
  const yieldYear = totalAlloc * apr / 100;

  const baselineRunway = 6.8;
  const protectedRunway = 4.0;
  const compliance = Math.min(99, 88 + Math.round(totalAlloc / 50));
  const concentration = Math.max(35, 60 - Math.round(totalAlloc / 16));

  return (
    <div className="page">
      <PageHead
        crumb="WORKSPACE / SIMULADOR"
        title="Cenários · simulate_scenario()"
        desc="Função pura `projectRunway(snapshot, obligations, policy)` recomputada em tempo real. Sem persistir. Compare baseline com até 2 cenários."
        actions={<>
          <button className="btn"><Icon name="cycle" size={13}/>Reset</button>
          <button className="btn primary" onClick={onApprove}>
            <Icon name="check" size={13}/>Aprovar cenário B
          </button>
        </>}
      />

      <div className="sim-grid">
        {/* Controls */}
        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="settings" size={13}/><span>Variáveis</span></div>
            <span className="meta">cenário B</span>
          </div>
          <div className="sim-controls">
            <div className="control">
              <div className="h">
                <span><Icon name="layers" size={12} style={{verticalAlign: -2, color: "var(--accent-2)"}}/> Kamino USDC</span>
                <span className="v">${kamino}k</span>
              </div>
              <input type="range" min="0" max="400" step="10" value={kamino} className="slider" onChange={e => setKamino(+e.target.value)}/>
              <div className="row between" style={{marginTop: 6}}>
                <span className="mono-sm">APR 5.84% · risk T1</span>
                <span className="mono" style={{fontSize: 11, color: "var(--pos)"}}>+${(kamino * 0.0584 / 12 * 1000).toFixed(0)}/mo</span>
              </div>
            </div>

            <div className="control">
              <div className="h">
                <span><Icon name="bank" size={12} style={{verticalAlign: -2, color: "var(--accent-3)"}}/> Mock RWA (USDY)</span>
                <span className="v">${rwa}k</span>
              </div>
              <input type="range" min="0" max="200" step="5" value={rwa} className="slider" onChange={e => setRwa(+e.target.value)}/>
              <div className="row between" style={{marginTop: 6}}>
                <span className="mono-sm">APR 4.82% · risk T2 · 1d redeem</span>
                <span className="mono" style={{fontSize: 11, color: "var(--pos)"}}>+${(rwa * 0.0482 / 12 * 1000).toFixed(0)}/mo</span>
              </div>
            </div>

            <div className="control">
              <div className="h">
                <span><Icon name="droplet" size={12} style={{verticalAlign: -2, color: "var(--fg-3)"}}/> SOL Liquid Staking</span>
                <span className="v">${sol}k</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={sol} className="slider" onChange={e => setSol(+e.target.value)}/>
              <div className="row between" style={{marginTop: 6}}>
                <span className="mono-sm">APR 7.2% · risk T3 · vol</span>
                <span className="tag warn" style={{fontSize: 9}}>FORA WHITELIST</span>
              </div>
            </div>

            <div className="control">
              <div className="h"><span>Burn projetado</span><span className="v">$120k/mo</span></div>
              <input type="range" min="80" max="200" defaultValue="120" className="slider"/>
            </div>
          </div>
        </div>

        {/* Compare */}
        <div>
          <div className="compare-grid">
            {/* Baseline */}
            <div className="compare-col">
              <div className="head"><span>BASELINE · ATUAL</span><span>v3</span></div>
              <div className="stat"><span className="k">Liquid runway</span><span className="v">{baselineRunway} mo</span></div>
              <div className="stat"><span className="k">Protected runway</span><span className="v">4.0 mo</span></div>
              <div className="stat"><span className="k">Yield/yr (est)</span><span className="v">$11,820</span></div>
              <div className="stat"><span className="k">APR blended</span><span className="v">5.42%</span></div>
              <div className="stat"><span className="k">Concentration</span><span className="v">60.6%</span></div>
              <div className="stat"><span className="k">Compliance</span><span className="v">94/100</span></div>
              <div className="stat"><span className="k">USDC livre</span><span className="v">$492k</span></div>
            </div>

            {/* Cenário A — conservador */}
            <div className="compare-col">
              <div className="head"><span>CENÁRIO A · CONSERVADOR</span></div>
              <div className="stat"><span className="k">Liquid runway</span><span className="v">5.4 mo</span><span className="d neg">−1.4</span></div>
              <div className="stat"><span className="k">Protected runway</span><span className="v">4.0 mo</span><span className="d">±0</span></div>
              <div className="stat"><span className="k">Yield/yr (est)</span><span className="v">$8,790</span><span className="d pos">+$8.8k</span></div>
              <div className="stat"><span className="k">APR blended</span><span className="v">5.84%</span><span className="d pos">+42bps</span></div>
              <div className="stat"><span className="k">Concentration</span><span className="v">42.1%</span><span className="d pos">−18.5</span></div>
              <div className="stat"><span className="k">Compliance</span><span className="v">96/100</span><span className="d pos">+2</span></div>
              <div className="stat"><span className="k">USDC livre</span><span className="v">$342k</span><span className="d neg">−$150k</span></div>
            </div>

            {/* Cenário B — recomendado */}
            <div className="compare-col b">
              <div className="head b"><span>CENÁRIO B · RECOMENDADO ★</span></div>
              <div className="stat"><span className="k">Liquid runway</span><span className="v">{(baselineRunway - totalAlloc/120).toFixed(1)} mo</span><span className={"d " + (totalAlloc > 0 ? "neg" : "")}>{totalAlloc > 0 ? `−${(totalAlloc/120).toFixed(1)}` : "±0"}</span></div>
              <div className="stat"><span className="k">Protected runway</span><span className="v">{protectedRunway.toFixed(1)} mo</span><span className="d">±0</span></div>
              <div className="stat"><span className="k">Yield/yr (est)</span><span className="v">${(yieldYear * 1000).toLocaleString("en-US", {maximumFractionDigits: 0})}</span><span className="d pos">+${(yieldYear * 1000 - 0).toLocaleString("en-US", {maximumFractionDigits: 0})}</span></div>
              <div className="stat"><span className="k">APR blended</span><span className="v">{apr.toFixed(2)}%</span><span className="d pos">+{(apr - 5.42).toFixed(2)}bps</span></div>
              <div className="stat"><span className="k">Concentration</span><span className="v">{concentration}%</span><span className="d pos">−{(60.6 - concentration).toFixed(1)}</span></div>
              <div className="stat"><span className="k">Compliance</span><span className="v">{compliance}/100</span><span className="d pos">+{compliance - 94}</span></div>
              <div className="stat"><span className="k">USDC livre</span><span className="v">${newLiquid}k</span><span className="d neg">−${baseLiquid - newLiquid}k</span></div>
            </div>
          </div>

          {/* Antes / Depois */}
          <div className="panel" style={{marginTop: 14}}>
            <div className="panel-head">
              <div className="left"><Icon name="cycle" size={13}/><span>Antes / Depois — runway protegido</span></div>
              <span className="meta">cenário B aplicado</span>
            </div>
            <div className="panel-body">
              <div className="mono-sm" style={{marginBottom: 6}}>Antes (atual)</div>
              <div className="runway-bar" style={{height: 36, marginBottom: 14}}>
                <div className="runway-seg" style={{width: "60%", background: "linear-gradient(135deg, oklch(0.4 0.01 240), oklch(0.32 0.008 240))"}}>
                  <div className="seg-l">USDC livre · 0% yield</div>
                </div>
                <div className="runway-seg" style={{width: "31%", background: "linear-gradient(135deg, oklch(0.5 0.16 220), oklch(0.4 0.12 220))"}}>
                  <div className="seg-l">Kamino · 5.84%</div>
                </div>
                <div className="runway-seg" style={{width: "9%", background: "linear-gradient(135deg, oklch(0.5 0.16 295), oklch(0.4 0.12 295))"}}>
                  <div className="seg-l">RWA</div>
                </div>
              </div>
              <div className="mono-sm" style={{marginBottom: 6}}>Depois (cenário B)</div>
              <div className="runway-bar" style={{height: 36}}>
                <div className="runway-seg" style={{width: `${Math.max(20, 60 - totalAlloc/16)}%`, background: "linear-gradient(135deg, oklch(0.4 0.01 240), oklch(0.32 0.008 240))"}}>
                  <div className="seg-l">USDC livre</div>
                </div>
                <div className="runway-seg" style={{width: `${(kamino/812)*100}%`, background: "linear-gradient(135deg, oklch(0.6 0.17 220), oklch(0.5 0.13 220))"}}>
                  <div className="seg-l">Kamino · 5.84%</div>
                </div>
                <div className="runway-seg" style={{width: `${(rwa/812)*100}%`, background: "linear-gradient(135deg, oklch(0.55 0.18 295), oklch(0.45 0.14 295))"}}>
                  <div className="seg-l">RWA · 4.82%</div>
                </div>
                {sol > 0 && (
                  <div className="runway-seg" style={{width: `${(sol/812)*100}%`, background: "linear-gradient(135deg, oklch(0.65 0.18 85), oklch(0.5 0.14 85))"}}>
                    <div className="seg-l">SOL · 7.2%</div>
                  </div>
                )}
              </div>
              <div className="row between" style={{marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)"}}>
                <span className="mono-sm">narrativa do agente</span>
                <span style={{fontSize: 12.5, color: "var(--fg-1)", maxWidth: "70%", textAlign: "right"}}>
                  Aloca <strong>${totalAlloc}k</strong> mantendo runway protegido em 4 meses. Yield estimado <strong>+${(yieldYear * 1000).toFixed(0)}/ano</strong>. Compliance sobe para <strong>{compliance}/100</strong>.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Simulator = Simulator;
