/* Execution drawer + intent state machine */

const ExecutionDrawer = ({ onClose, simulated }) => {
  const [stage, setStage] = React.useState(simulated ? 6 : 2);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    if (!running) return;
    if (stage >= 6) { setRunning(false); return; }
    const t = setTimeout(() => setStage(stage + 1), simulated ? 380 : 700);
    return () => clearTimeout(t);
  }, [running, stage, simulated]);

  const sign = () => { setStage(simulated ? 6 : 4); setRunning(true); };

  const txhash = simulated
    ? "SIM-4af2-9c12-e08a"
    : "5kZ9xT…DvY3hPq8mB1NfA7";

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <div className="mono-sm">INTENT · 01HXC9F · idempotency_key 0xa9…2c</div>
          <div style={{fontSize: 15, fontWeight: 600, marginTop: 2}}>Depositar 250,000 USDC em Kamino</div>
        </div>
        <button className="btn icon" onClick={onClose}><Icon name="x" size={14}/></button>
      </div>

      <div className="drawer-body">
        <div className="row between">
          <span className="mono-sm">Estado atual</span>
          <span className={"tag " + (stage >= 6 ? "pos" : stage >= 3 ? "warn" : "")}>
            {TOS.TX_STEPS[Math.min(stage, 6)].id}
          </span>
        </div>

        <div className="state-track">
          {TOS.TX_STEPS.map((s, i) => (
            <div key={s.id} className={"state-step" + (i < stage ? " done" : i === stage ? " active" : "")}>
              <div className="pip">
                {i < stage ? <Icon name="check" size={11}/> : i === stage ? <span className="dot pulse" style={{background: "var(--accent)"}}></span> : (i+1)}
              </div>
              <div className="label">{s.label}</div>
              <div className="when">{i <= stage ? s.when : "—"}</div>
            </div>
          ))}
        </div>

        <div className="panel" style={{marginTop: 14, background: "var(--bg-2)"}}>
          <div className="panel-head"><div className="left"><Icon name="info" size={12}/><span>Detalhes</span></div></div>
          <div className="panel-body" style={{padding: 12, display: "grid", gap: 6, fontSize: 12}}>
            <div className="row between"><span className="mono-sm">Adapter</span><span className="mono" style={{fontSize: 11}}>kamino-usdc-devnet</span></div>
            <div className="row between"><span className="mono-sm">Wallet</span><span className="mono" style={{fontSize: 11}}>{TOS.ORG.fullWallet}</span></div>
            <div className="row between"><span className="mono-sm">Recent blockhash</span><span className="mono" style={{fontSize: 11}}>5T1m…f8Wq</span></div>
            <div className="row between"><span className="mono-sm">Compute budget</span><span className="mono" style={{fontSize: 11}}>200,000 cu</span></div>
            <div className="row between"><span className="mono-sm">Priority fee</span><span className="mono" style={{fontSize: 11}}>0.000005 SOL</span></div>
            {stage >= 6 && (
              <div className="row between" style={{paddingTop: 6, marginTop: 4, borderTop: "1px solid var(--line)"}}>
                <span className="mono-sm">tx signature</span>
                <span className={"txhash" + (simulated ? " sim" : "")}>{txhash}</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{marginTop: 12}}>
          <div className="panel-head"><div className="left"><Icon name="shield" size={12}/><span>Validação rules-engine</span></div><span className="tag pos">7/7 OK</span></div>
          <div className="panel-body" style={{padding: 12, display: "grid", gap: 4, fontSize: 11.5}}>
            <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>MIN_RUNWAY_DAYS · runway pós-tx 4.0 mo &gt; 4.0 ✓</span></div>
            <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>MAX_CONCENTRATION_PCT · Kamino 30.8% &lt; 45% ✓</span></div>
            <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>ALLOCATION_WHITELIST · kamino-usdc ∈ whitelist ✓</span></div>
            <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>YIELD_ONLY_EXCESS · valor saiu do excedente ✓</span></div>
          </div>
        </div>
      </div>

      <div className="drawer-foot">
        <button className="btn">Rejeitar</button>
        {stage < (simulated ? 6 : 4) ? (
          <button className={"btn " + (simulated ? "violet" : "primary")} onClick={sign}>
            {simulated ? <><Icon name="bolt" size={12}/> Simular execução</> : <><span className="phantom-icon" style={{width: 16, height: 16, fontSize: 9}}>P</span> Assinar com Phantom</>}
          </button>
        ) : stage < 6 ? (
          <button className="btn" disabled><span className="dot pulse" style={{background: "var(--accent)"}}></span> Broadcasting…</button>
        ) : (
          <button className="btn primary" onClick={onClose}><Icon name="check" size={12}/> Concluído</button>
        )}
      </div>
    </div>
  );
};

const ExecutionPage = ({ openDrawer }) => (
  <div className="page">
    <PageHead
      crumb="WORKSPACE / EXECUÇÃO"
      title="Intents · State Machine"
      desc="DRAFT → PROPOSED → APPROVED → QUEUED → SIGNING → BROADCAST → CONFIRMED. Idempotency key + lock otimista evitam duplo-aprove."
      actions={<button className="btn primary" onClick={openDrawer}><Icon name="plus" size={13}/>Nova intent</button>}
    />

    <div className="panel">
      <div className="panel-head">
        <div className="left"><Icon name="bolt" size={13}/><span>Histórico</span></div>
        <span className="meta">12 executadas · 1 simulada</span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>ID</th><th>Tipo</th><th>Adapter</th><th className="num">Valor</th><th>Estado</th><th>tx</th><th className="num">Confirmada</th>
          </tr>
        </thead>
        <tbody>
          {[
            { id: "01HXC9F", k: "DEPOSIT",  ad: "kamino-usdc-devnet",   v: "+250,000", s: "ACTIVE", tx: "5kZ9xT…hPq8", live: true,  when: "12:04:46" },
            { id: "01HXC8A", k: "DEPOSIT",  ad: "mock-rwa-usdy",        v: "+70,000",  s: "ACTIVE", tx: "SIM-4af2-9c12", live: false, when: "12:01:18" },
            { id: "01HW0K2", k: "WITHDRAW", ad: "kamino-usdc-devnet",   v: "−18,500",  s: "CLOSED", tx: "9pLm…xR2t", live: true,  when: "ontem 17:42" },
            { id: "01HV9Z1", k: "REBALANCE",ad: "rules-engine trigger", v: "+12,000",  s: "CLOSED", tx: "7nQk…aH1y", live: true,  when: "27 mai" },
          ].map(r => (
            <tr key={r.id}>
              <td className="mono">{r.id}</td>
              <td><span className="tag">{r.k}</span></td>
              <td className="mono" style={{fontSize: 11}}>{r.ad}</td>
              <td className="num" style={{color: r.v.startsWith("+") ? "var(--pos)" : "var(--neg)"}}>{r.v}</td>
              <td><span className={"tag " + (r.s === "ACTIVE" ? "pos" : "")}>{r.s}</span></td>
              <td><span className={"txhash" + (!r.live ? " sim" : "")}>{r.tx}</span></td>
              <td className="num muted">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

Object.assign(window, { ExecutionDrawer, ExecutionPage });
