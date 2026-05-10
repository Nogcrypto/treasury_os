/* Onboarding — Phantom Connect + SIWS + wizard */

const Onboarding = ({ onDone }) => {
  const [step, setStep] = React.useState(0);
  const [profile, setProfile] = React.useState("startup");
  const [connected, setConnected] = React.useState(false);
  const [signing, setSigning]     = React.useState(false);
  const [burn, setBurn]           = React.useState("120000");
  const [payDay, setPayDay]       = React.useState("5");
  const [payAmount, setPayAmount] = React.useState("96000");
  const [taxPct, setTaxPct]       = React.useState("12");

  const STEPS = ["Org", "Wallet", "Wizard", "Buckets"];

  const connect = () => {
    setSigning(true);
    setTimeout(() => { setConnected(true); setSigning(false); }, 1100);
  };

  return (
    <div className="onboard-wrap">
      {/* LEFT — hero */}
      <div className="onboard-left">
        <Brand />
        <div style={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 32}}>
          <h1 className="hero-h">Tesouraria como <em>política executável</em>.</h1>
          <p className="hero-p">Conecte a wallet, declare seus compromissos, e o copiloto traduz isso em buckets, regras e alocações onchain. Determinístico onde importa, IA onde ajuda.</p>

          <div className="hero-mock">
            <div className="head">snapshot · capivara_labs · live</div>
            <div className="row"><span>total_treasury</span><span className="v num">$812,440</span></div>
            <div className="row"><span>liquid_runway</span><span className="v num">6.8 mo</span></div>
            <div className="row"><span>protected_runway</span><span className="v num">4.0 mo</span></div>
            <div className="row acc"><span>excedente_alocavel</span><span className="v num">$319,940</span></div>
            <div className="row"><span>compliance_score</span><span className="v num">94 / 100</span></div>
            <div style={{marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", color: "var(--fg-3)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase"}}>
              policy v3 · balanced · rules-engine: 7/7 ok
            </div>
          </div>
        </div>
        <div className="mono-sm" style={{marginTop: 24}}>
          <span className="dot pulse" style={{background: "var(--pos)", marginRight: 6}}></span>
          DEVNET · HELIUS WEBHOOKS ATIVOS · RPC FAST 12MS
        </div>
      </div>

      {/* RIGHT — wizard */}
      <div className="onboard-right">
        <div className="onboard-card">
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={i} className={"step-pip" + (i === step ? " active" : i < step ? " done" : "")}></div>
            ))}
          </div>
          <div className="mono-sm" style={{marginBottom: 6}}>Etapa {step + 1} / {STEPS.length} · {STEPS[step]}</div>

          {step === 0 && (
            <div className="fade-up">
              <h2 style={{margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em"}}>Bem-vindo, founder.</h2>
              <p style={{margin: "0 0 22px", color: "var(--fg-2)", fontSize: 13}}>
                Comece com um perfil. Isso só seleciona presets e métricas relevantes — você muda depois.
              </p>

              <div className="field-row">
                <label>Nome da org</label>
                <input className="field" defaultValue="Capivara Labs" />
              </div>

              <div className="field-row">
                <label>Perfil</label>
                <div className="profile-grid">
                  <button className={"profile-card" + (profile === "startup" ? " sel" : "")} onClick={() => setProfile("startup")}>
                    <div className="ico"><Icon name="bolt" size={14}/></div>
                    <div>
                      <div className="name">Startup</div>
                      <div className="sub">SAFE/equity · burn predict.</div>
                    </div>
                  </button>
                  <button className={"profile-card" + (profile === "dao" ? " sel" : "")} onClick={() => setProfile("dao")}>
                    <div className="ico cyan"><Icon name="layers" size={14}/></div>
                    <div>
                      <div className="name">DAO</div>
                      <div className="sub">grants · multisig</div>
                    </div>
                  </button>
                  <button className={"profile-card" + (profile === "fund" ? " sel" : "")} onClick={() => setProfile("fund")}>
                    <div className="ico"><Icon name="bank" size={14}/></div>
                    <div>
                      <div className="name">SMB / Fund</div>
                      <div className="sub">tokenize equity</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="field-row">
                <label>Moeda base</label>
                <select className="field">
                  <option>USDC (Solana)</option>
                  <option>USDC + BRL ref.</option>
                  <option>EURC</option>
                </select>
              </div>

              <button className="btn primary lg" style={{width: "100%", justifyContent: "center", marginTop: 8}} onClick={() => setStep(1)}>
                Continuar <Icon name="arrowRight" size={14}/>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="fade-up">
              <h2 style={{margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em"}}>Conecte sua wallet.</h2>
              <p style={{margin: "0 0 22px", color: "var(--fg-2)", fontSize: 13}}>
                Não custodiamos chaves. Phantom assina uma mensagem (SIWS) só para vincular esta wallet à org.
              </p>

              <div className="panel" style={{padding: 0}}>
                <div className="panel-head">
                  <div className="left">
                    <div className="dot pulse" style={{background: connected ? "var(--pos)" : "var(--accent-3)"}}></div>
                    <span>Phantom · Solana Devnet</span>
                  </div>
                  <span className="meta">{connected ? "VINCULADA" : "AGUARDANDO"}</span>
                </div>
                <div className="panel-body" style={{display: "grid", gap: 12}}>
                  {!connected && !signing && (
                    <button className="phantom-glow" style={{justifyContent: "center"}} onClick={connect}>
                      <span className="phantom-icon">P</span>
                      <span>Conectar Phantom</span>
                    </button>
                  )}
                  {signing && (
                    <div className="row gap-s" style={{padding: "8px 0", color: "var(--fg-2)"}}>
                      <span className="dot pulse" style={{background: "var(--accent-3)"}}></span>
                      <span className="mono" style={{fontSize: 12}}>Aguardando assinatura · sign-in-with-solana…</span>
                    </div>
                  )}
                  {connected && (
                    <>
                      <div className="row between">
                        <span className="mono-sm">Endereço</span>
                        <span className="mono" style={{fontSize: 11.5}}>{TOS.ORG.fullWallet}</span>
                      </div>
                      <div className="row between">
                        <span className="mono-sm">Cluster</span>
                        <span className="tag pos">DEVNET</span>
                      </div>
                      <div className="row between">
                        <span className="mono-sm">SIWS Nonce</span>
                        <span className="mono" style={{fontSize: 11}}>0x4af2…ec08</span>
                      </div>
                      <div className="row between">
                        <span className="mono-sm">Saldo USDC</span>
                        <span className="mono num" style={{fontSize: 12, color: "var(--fg)"}}>800,000.00</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="row" style={{marginTop: 16, justifyContent: "space-between"}}>
                <button className="btn" onClick={() => setStep(0)}>Voltar</button>
                <button className="btn primary lg" onClick={() => setStep(2)} disabled={!connected}>
                  Continuar <Icon name="arrowRight" size={14}/>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-up">
              <h2 style={{margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em"}}>Compromissos da operação.</h2>
              <p style={{margin: "0 0 22px", color: "var(--fg-2)", fontSize: 13}}>
                Três campos. O resto a gente infere a partir do snapshot da wallet.
              </p>

              <div className="field-row">
                <label>Burn mensal</label>
                <div className="field-suffix">
                  <input className="field" value={burn} onChange={e => setBurn(e.target.value)} />
                  <span className="suffix">USDC / mês</span>
                </div>
              </div>

              <div className="field-row">
                <label>Folha</label>
                <div style={{display: "grid", gridTemplateColumns: "120px 1fr", gap: 8}}>
                  <div className="field-suffix">
                    <input className="field" value={payDay} onChange={e => setPayDay(e.target.value)} />
                    <span className="suffix">dia</span>
                  </div>
                  <div className="field-suffix">
                    <input className="field" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    <span className="suffix">USDC</span>
                  </div>
                </div>
              </div>

              <div className="field-row">
                <label>Imposto trimestral estimado</label>
                <div className="field-suffix">
                  <input className="field" value={taxPct} onChange={e => setTaxPct(e.target.value)} />
                  <span className="suffix">% sobre receita</span>
                </div>
              </div>

              <div className="row" style={{marginTop: 8, justifyContent: "space-between"}}>
                <button className="btn" onClick={() => setStep(1)}>Voltar</button>
                <button className="btn primary lg" onClick={() => setStep(3)}>
                  Gerar buckets <Icon name="sparkles" size={14}/>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-up">
              <h2 style={{margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em"}}>Buckets gerados.</h2>
              <p style={{margin: "0 0 18px", color: "var(--fg-2)", fontSize: 13}}>
                Política sugerida: <strong style={{color: "var(--fg)"}}>Conservadora</strong>. Você revisa e edita antes de ativar.
              </p>

              <div className="panel" style={{padding: 0}}>
                <div className="bucket-row">
                  {TOS.BUCKETS.map(b => {
                    const fill = b.target ? Math.min(100, (b.balance / b.target) * 100) : 0;
                    return (
                      <div className="bucket" key={b.kind} style={{gridTemplateColumns: "1fr 90px 1fr"}}>
                        <div>
                          <div className="name">{b.name}</div>
                          <div className="sub">{b.sub}</div>
                        </div>
                        <div className="num right">{fmtUSD(b.balance)}</div>
                        <div className="bar" style={{maxWidth: 140, marginLeft: "auto"}}>
                          <div className="fill" style={{width: fill + "%"}}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="row" style={{marginTop: 16, justifyContent: "space-between"}}>
                <button className="btn" onClick={() => setStep(2)}>Voltar</button>
                <button className="btn primary lg" onClick={onDone}>
                  Abrir cockpit <Icon name="arrowRight" size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.Onboarding = Onboarding;
