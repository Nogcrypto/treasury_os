/* Policy Engine */

const Policy = ({ onOpenCopilot }) => {
  const [sel, setSel] = React.useState("balanced");
  const [rules, setRules] = React.useState(TOS.RULES);

  const toggle = (id) => setRules(rules.map(r => r.id === id ? { ...r, on: !r.on } : r));

  return (
    <div className="page">
      <PageHead
        crumb="WORKSPACE / POLICY ENGINE"
        title="Policy v3 · Balanced"
        desc="A IA propõe e explica. O rules-engine determinístico valida antes de virar intent. Mudanças geram nova versão com diff e audit trail."
        actions={<>
          <button className="btn"><Icon name="file" size={13}/>Versões (3)</button>
          <button className="btn"><Icon name="wand" size={13}/>Editar via texto</button>
          <button className="btn primary"><Icon name="check" size={13}/>Ativar policy</button>
        </>}
      />

      {/* Presets */}
      <div className="mono-sm" style={{marginBottom: 8}}>Presets</div>
      <div className="preset-grid">
        {TOS.POLICIES.map(p => (
          <div key={p.id} className={"preset-card" + (sel === p.id ? " sel" : "")} onClick={() => setSel(p.id)}>
            <div className="row between">
              <div className="name">
                {p.id === "conservative" && <Icon name="shield" size={14}/>}
                {p.id === "balanced" && <Icon name="target" size={14}/>}
                {p.id === "aggressive" && <Icon name="fire" size={14}/>}
                {p.name}
              </div>
              {sel === p.id && <span className="tag pos">ATIVA</span>}
            </div>
            <div className="desc">{p.desc}</div>
            <div className="stats">
              <span className="k">runway mín.</span><span className="v">{p.runway} meses</span>
              <span className="k">conc. máx.</span><span className="v">{p.conc}%</span>
              <span className="k">líquido mín.</span><span className="v">{p.liquid}%</span>
              <span className="k">whitelist</span><span className="v">2 adapters</span>
            </div>
          </div>
        ))}
      </div>

      <div className="split-2-1">
        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="settings" size={13}/><span>Regras primitivas</span></div>
            <span className="meta">7 tipos · zod-validated</span>
          </div>
          <div className="rules">
            {rules.map(r => (
              <div className="rule-row" key={r.id}>
                <div className="icon"><Icon name="check" size={12}/></div>
                <div>
                  <div className="label">{r.label}</div>
                  <div className="desc">{r.desc} · <span className="mono" style={{color: "var(--fg-3)"}}>{r.id}</span></div>
                </div>
                <div className="knob">{r.v}</div>
                <div className="status"><Toggle on={r.on} onClick={() => toggle(r.id)}/></div>
              </div>
            ))}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="wand" size={13}/><span>Editar via texto</span></div>
              <span className="meta">Opus 4.7 · tool use</span>
            </div>
            <div className="panel-body">
              <textarea
                className="field"
                style={{minHeight: 90, padding: 10, lineHeight: 1.5, resize: "vertical"}}
                defaultValue="Quero 4 meses protegidos, sem mais de 30% num protocolo, aplica só o excedente."
              />
              <div className="row between" style={{marginTop: 10}}>
                <span className="mono-sm">rules-engine valida antes de salvar</span>
                <button className="btn primary sm" onClick={onOpenCopilot}>
                  <Icon name="sparkles" size={12}/> Gerar JSON
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="file" size={13}/><span>Versões</span></div>
              <span className="meta">audit log</span>
            </div>
            <div className="panel-body" style={{padding: 0}}>
              {[
                { v: "v3", who: "Copilot · você aprovou", when: "hoje 12:04", tag: "ATIVA", cls: "pos" },
                { v: "v2", who: "Founder · manual edit",   when: "27 mai 18:12", tag: "ARQUIVADA" },
                { v: "v1", who: "Wizard · seed",            when: "15 mai 09:30", tag: "ARQUIVADA" },
              ].map((v, i) => (
                <div key={i} className="alert-row" style={{gridTemplateColumns: "auto 1fr auto"}}>
                  <span className="mono" style={{fontSize: 11, color: "var(--fg-2)"}}>{v.v}</span>
                  <div>
                    <div style={{fontWeight: 500}}>{v.who}</div>
                    <div className="mono-sm" style={{textTransform: "none", letterSpacing: 0, marginTop: 1}}>{v.when}</div>
                  </div>
                  <span className={"tag " + (v.cls || "")}>{v.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Policy = Policy;
