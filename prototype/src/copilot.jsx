/* Copilot */

const Copilot = ({ onApprove }) => {
  const [draft, setDraft] = React.useState("");
  const send = (txt) => { setDraft(""); /* scripted */ };

  return (
    <div className="page" style={{paddingBottom: 28}}>
      <PageHead
        crumb="WORKSPACE / AI COPILOT"
        title="Copilot · TreasuryOS"
        desc="Claude com 5 tools determinísticas. Toda ação proposta passa por rules-engine.validate() antes de virar intent. Prompt caching ativo nos blocos de policy + snapshots."
        actions={<>
          <span className="tag pos">cached: policy_v3 + 3 snapshots</span>
          <button className="btn"><Icon name="cycle" size={13}/>Nova thread</button>
        </>}
      />

      <div className="copilot-wrap">
        <div className="chat">
          <div className="chat-stream">
            {TOS.COPILOT_THREAD.map((m, i) => (
              <div key={i} className={"msg " + (m.role === "user" ? "user" : "")}>
                <div className={"av " + (m.role === "ai" ? "ai" : "usr")}>{m.role === "ai" ? "AI" : "VC"}</div>
                <div className="bubble">
                  {m.meta && (
                    <div className="meta">
                      <span style={{color: "var(--accent)"}}>● {m.meta[0]}</span>
                      {m.meta.slice(1).map((x, j) => <span key={j}>· {x}</span>)}
                    </div>
                  )}
                  {m.tool && (
                    <div className="tool-call">
                      <div className="head">
                        <span><span className="name">{m.tool.name}</span>(...)</span>
                        <span style={{color: "var(--fg-3)"}}>tool_use_id 01H…7F</span>
                      </div>
                      <div className="body">
                        <div style={{color: "var(--fg-3)"}}>// input</div>
                        <div>{JSON.stringify(m.tool.args, null, 2)}</div>
                        <div style={{color: "var(--fg-3)", marginTop: 6}}>// output (validated)</div>
                        <div style={{color: "var(--accent)"}}>{JSON.stringify(m.tool.result, null, 2)}</div>
                      </div>
                    </div>
                  )}
                  {m.body.map((b, j) => (
                    <p key={j} dangerouslySetInnerHTML={{__html: b.p}}/>
                  ))}
                  {m.rationale && (
                    <div className="rationale-card">
                      <div className="h"><Icon name="sparkles" size={12}/> {m.rationale.title}</div>
                      <div className="actions">
                        {m.rationale.actions.map(a => (
                          <div className="rationale-action" key={a.n}>
                            <span className="num">#{a.n}</span>
                            <div>
                              <div style={{fontWeight: 500}}>{a.label}</div>
                              <div className="mono-sm" style={{textTransform: "none", letterSpacing: 0, marginTop: 1}}>{a.sub}</div>
                            </div>
                            <span className="tag pos">{a.v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="row between" style={{marginTop: 4}}>
                        <span className="mono-sm" style={{textTransform: "none", letterSpacing: 0, color: "var(--fg-2)"}}>{m.rationale.footer}</span>
                        <div className="row gap-s">
                          <button className="btn sm">Editar</button>
                          <button className="btn primary sm" onClick={onApprove}>
                            <Icon name="check" size={11}/> Aprovar e simular
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <textarea
              placeholder="Pergunte algo, descreva uma policy, ou peça uma simulação…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <button className="btn icon" title="Anexar"><Icon name="paperclip" size={13}/></button>
            <button className="btn primary"><Icon name="send" size={12}/> Enviar</button>
          </div>
        </div>

        <div className="copilot-side">
          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="settings" size={13}/><span>Tools disponíveis</span></div>
              <span className="meta">5</span>
            </div>
            <div className="tool-list">
              {TOS.COPILOT_TOOLS.map(t => (
                <div className="tool-item" key={t.id}>
                  <div className="ico"><Icon name="bolt" size={11}/></div>
                  <div>
                    <div className="name mono" style={{fontSize: 11.5}}>{t.name}()</div>
                    <div className="sub">{t.sub}</div>
                  </div>
                  <span className="tag pos" style={{fontSize: 9, padding: "1px 5px"}}>OK</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="sparkles" size={13}/><span>Sugestões</span></div>
            </div>
            <div className="suggest-list">
              {TOS.COPILOT_SUGGESTS.map((s, i) => (
                <div className="suggest" key={i} onClick={() => setDraft(s)}>
                  <Icon name="arrowRight" size={11}/>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="shield" size={13}/><span>Guardrails</span></div>
            </div>
            <div className="panel-body" style={{display: "grid", gap: 8, fontSize: 12}}>
              <div className="row gap-s"><Icon name="check" size={12} style={{color: "var(--pos)"}}/><span>rules-engine.validateAction antes de qualquer intent</span></div>
              <div className="row gap-s"><Icon name="check" size={12} style={{color: "var(--pos)"}}/><span>Reprompt automático se ação violar policy (max 2)</span></div>
              <div className="row gap-s"><Icon name="check" size={12} style={{color: "var(--pos)"}}/><span>Rate limit 10 calls/min · audit log append-only</span></div>
              <div className="row gap-s"><Icon name="check" size={12} style={{color: "var(--pos)"}}/><span>Toda ação assinada via Phantom no device</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Copilot = Copilot;
