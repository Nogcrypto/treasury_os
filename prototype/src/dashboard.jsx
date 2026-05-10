/* Dashboard — cockpit */

const Dashboard = ({ onOpenSimulator, onOpenCopilot, onOpenExecution }) => {
  return (
    <div className="page">
      <PageHead
        crumb="WORKSPACE / DASHBOARD"
        title="Cockpit · Capivara Labs"
        desc="Snapshot de tesouraria atualizado a cada 5 min via Helius webhooks. Política Balanced v3 ativa."
        actions={<>
          <button className="btn"><Icon name="download" size={13}/>Export PDF</button>
          <button className="btn"><Icon name="cycle" size={13}/>Snapshot agora</button>
          <button className="btn primary" onClick={onOpenCopilot}><Icon name="sparkles" size={13}/>Pedir ao Copilot</button>
        </>}
      />

      {/* KPIs 8-up */}
      <div className="kpi-grid">
        {TOS.KPIS.map(k => (
          <div className="kpi" key={k.k}>
            <div className="label">{k.k}{k.tip && <Tooltip text={k.tip} />}</div>
            <div className="v">{k.v}<span className="unit">{k.unit}</span></div>
            <div className="delta">
              <span className={k.pos ? "pos-c" : ""} style={{color: k.pos ? "var(--pos)" : "var(--neg)"}}>{k.delta}</span>
            </div>
            <div className="spark"><Sparkline kind={k.spark} /></div>
          </div>
        ))}
      </div>

      {/* Runway visualization */}
      <div className="panel" style={{marginTop: 14}}>
        <div className="panel-head">
          <div className="left">
            <Icon name="pulse" size={13} />
            <span>Runway protegido vs. excedente</span>
            <Tooltip text="Runway = quantos meses sua empresa opera com o caixa atual no burn atual. 'Protegido' = parte que NÃO está exposta a risco (operacional + folha + impostos + reserva). 'Excedente' = sobra alocável em yield." />
            <span className="tag">políticas: 4 meses mín.</span>
          </div>
          <span className="meta">USDC · base 120k/mês burn</span>
        </div>
        <div className="panel-body">
          <div className="runway-viz">
            <div className="runway-bar">
              <div className="runway-seg" style={{width: "29%", background: "linear-gradient(135deg, oklch(0.5 0.16 148), oklch(0.4 0.12 148))"}}>
                <div className="seg-l">Operacional</div>
                <div className="seg-v">$240k · 60d</div>
              </div>
              <div className="runway-seg" style={{width: "11%", background: "linear-gradient(135deg, oklch(0.45 0.14 220), oklch(0.36 0.1 220))"}}>
                <div className="seg-l">Folha</div>
                <div className="seg-v">$88k</div>
              </div>
              <div className="runway-seg" style={{width: "8%", background: "linear-gradient(135deg, oklch(0.5 0.14 85), oklch(0.4 0.1 85))"}}>
                <div className="seg-l">Tax</div>
                <div className="seg-v">$64k</div>
              </div>
              <div className="runway-seg" style={{width: "12%", background: "linear-gradient(135deg, oklch(0.5 0.18 295), oklch(0.4 0.14 295))"}}>
                <div className="seg-l">Reserva</div>
                <div className="seg-v">$100k</div>
              </div>
              <div className="runway-seg" style={{width: "40%", background: "linear-gradient(135deg, oklch(0.78 0.18 148), oklch(0.6 0.16 148))"}}>
                <div className="seg-l">Excedente alocável</div>
                <div className="seg-v">$319.9k · yield disponível</div>
              </div>
            </div>
            <div className="runway-axis">
              <span>0d</span><span>60d</span><span>120d</span><span>180d</span><span>200d+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Buckets + concentration */}
      <div className="split-2-1" style={{marginTop: 14}}>
        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="layers2" size={13}/><span>Buckets</span><Tooltip text="Buckets dividem o caixa por finalidade (operacional, folha, impostos, reserva, yield). Cada um tem meta e regras próprias — separar evita usar reserva para pagar yield, por exemplo." /></div>
            <span className="meta">5 ativos · meta vs realizado</span>
          </div>
          <div className="bucket-row">
            {TOS.BUCKETS.map(b => {
              const fill = b.target ? Math.min(100, (b.balance / b.target) * 100) : 100;
              const cls = b.target && b.balance < b.target ? "warn" : "";
              return (
                <div className="bucket" key={b.kind}>
                  <div className="ico" style={{background: "var(--bg-3)"}}>
                    <Icon name={b.kind === "operating" ? "bolt" : b.kind === "payroll" ? "user" : b.kind === "tax" ? "feather" : b.kind === "emergency" ? "shield" : "sparkles"} size={12}/>
                  </div>
                  <div>
                    <div className="name">{b.name}</div>
                    <div className="sub">{b.sub}</div>
                  </div>
                  <div className="num right">{fmtUSD(b.balance)}</div>
                  <div className="pct right">{b.target ? `meta ${fmtUSD(b.target)}` : "sem meta"}</div>
                  <div className="bar">
                    <div className={"fill " + cls} style={{width: fill + "%"}}></div>
                    {b.target && <div className="target" style={{left: "100%"}}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="target" size={13}/><span>Concentração</span><Tooltip text="Concentração = % do caixa em um único protocolo, ativo ou contraparte. Limite (70%) evita risco sistêmico — se o protocolo cair, você não perde tudo." /></div>
            <span className="meta">limite 70%</span>
          </div>
          <div className="panel-body">
            <div className="donut-wrap">
              <Donut data={TOS.CONCENTRATION} size={132} />
              <div className="donut-legend">
                {TOS.CONCENTRATION.map(c => (
                  <div className="row" key={c.name}>
                    <div className="swatch" style={{background: c.color}}></div>
                    <div className="name">{c.name}</div>
                    <div className="num">{fmtUSD(c.v)}</div>
                    <div className="pct">{c.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="scn-line"></div>
            <div className="row between">
              <div>
                <div className="mono-sm">Compliance score</div>
                <div className="mono" style={{fontSize: 28, fontWeight: 600, color: "var(--accent)", marginTop: 2}}>94<span style={{fontSize: 13, color: "var(--fg-3)"}}>/100</span></div>
              </div>
              <Gauge value={94} />
            </div>
          </div>
        </div>
      </div>

      {/* Posições + obrigações */}
      <div className="split-2-1" style={{marginTop: 14}}>
        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="layers" size={13}/><span>Posições onchain</span></div>
            <div className="row gap-s">
              <span className="tag pos">2 protocolos</span>
              <button className="btn sm" onClick={onOpenExecution}>Nova alocação <Icon name="arrowRight" size={11}/></button>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Ativo</th>
                <th>Estratégia</th>
                <th className="num">Posição</th>
                <th className="num">APR</th>
                <th className="num">Yield acum.</th>
                <th>Risk</th>
                <th>Dias</th>
              </tr>
            </thead>
            <tbody>
              {TOS.POSITIONS.map(p => (
                <tr key={p.id}>
                  <td><strong style={{color: "var(--fg)"}}>{p.protocol}</strong></td>
                  <td><span className="tag">{p.asset}</span></td>
                  <td>{p.strategy}</td>
                  <td className="num">{fmtUSD(p.amount)}</td>
                  <td className="num" style={{color: "var(--pos)"}}>{p.apr.toFixed(2)}%</td>
                  <td className="num">+${p.accrued.toFixed(2)}</td>
                  <td><span className={"tag " + (p.risk === 1 ? "pos" : "warn")}>T{p.risk}</span></td>
                  <td className="num muted">{p.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="list" size={13}/><span>Obrigações 30/60/90d</span></div>
            <span className="meta">6 eventos</span>
          </div>
          <div className="panel-body">
            <div className="timeline">
              {TOS.OBLIGATIONS.map((o, i) => (
                <div className={"t-item " + (o.level || "")} key={i}>
                  <div className="when">{o.when}</div>
                  <div>
                    <div className="label">{o.label}</div>
                    <div className="sub">{o.sub}</div>
                  </div>
                  <div className="v" style={{color: o.v.startsWith("+") ? "var(--pos)" : "var(--fg)"}}>{o.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="panel" style={{marginTop: 14}}>
        <div className="panel-head">
          <div className="left"><Icon name="bell2" size={13}/><span>Alertas</span></div>
          <span className="meta">3 abertos · in-app</span>
        </div>
        {TOS.ALERTS.map((a, i) => (
          <div className="alert-row" key={i}>
            <div className="pip" style={{background: a.kind === "warn" ? "var(--warn)" : "var(--pos)"}}></div>
            <div>
              <div style={{fontWeight: 600, color: "var(--fg)"}}>{a.title}</div>
              <div className="sub mono-sm" style={{textTransform: "none", letterSpacing: 0, marginTop: 2}}>{a.sub}</div>
            </div>
            <button className="btn sm">Resolver</button>
          </div>
        ))}
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
