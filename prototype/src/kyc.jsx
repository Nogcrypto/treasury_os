/* Equity Studio — KYC gate + minted state */

const KYC_DOCS = [
  { id: "cnpj", name: "Contrato Social / CNPJ", sub: "PDF · jurisdição da empresa", req: "obrigatório" },
  { id: "cap",  name: "Cap table atual",         sub: "Excel ou PDF · holders e %", req: "obrigatório" },
  { id: "fin",  name: "Demonstrativo financeiro", sub: "últimos 12 meses · receita e burn", req: "obrigatório" },
  { id: "id",   name: "Documento dos sócios",    sub: "RG/CNH/Passport · 1 por sócio", req: "obrigatório" },
  { id: "rev",  name: "Comprovante de receita",  sub: "extrato bancário ou onchain", req: "recomendado" },
  { id: "leg",  name: "Parecer jurídico",        sub: "elegibilidade para emissão", req: "opcional" },
];

const KYCFlow = ({ onApproved }) => {
  const [up, setUp] = React.useState({});
  const upload = (id) => setUp(s => ({ ...s, [id]: true }));
  const required = KYC_DOCS.filter(d => d.req === "obrigatório").length;
  const done = KYC_DOCS.filter(d => d.req === "obrigatório" && up[d.id]).length;
  const pct = (done / required) * 100;
  const allRequired = done === required;

  return (
    <div className="page">
      <PageHead
        crumb="WORKSPACE / EQUITY STUDIO / VERIFICAÇÃO"
        title="KYC empresarial · antes de emitir"
        desc="Para tokenizar equity da sua empresa precisamos validar quem você é, quem são os sócios e como a empresa está estruturada. É um processo único — depois de aprovado, você pode mintar quantas tranches quiser."
      />

      <HelpBanner title="Por que isso é necessário?">
        TreasuryOS emite SPL tokens em nome da sua empresa. Sem essa verificação, qualquer wallet poderia criar tokens com nomes corporativos enganosos. O KYC fica registrado no contrato (whitelist on-chain) e protege sua marca, seus holders e te deixa em compliance.
      </HelpBanner>

      <div className="kyc-progress" style={{marginBottom: 14}}>
        <div>
          <div className="row between" style={{marginBottom: 6}}>
            <div>
              <div style={{fontWeight: 600, fontSize: 13}}>Progresso · {done} de {required} documentos obrigatórios</div>
              <div className="mono-sm" style={{textTransform: "none", letterSpacing: 0, marginTop: 2}}>SLA de aprovação manual: até 24h após envio completo</div>
            </div>
            <span className={"tag " + (allRequired ? "pos" : "warn")}>{allRequired ? "PRONTO PARA REVISÃO" : "AGUARDANDO ENVIO"}</span>
          </div>
          <div className="bar" style={{height: 8}}>
            <div className="fill" style={{width: pct + "%"}}></div>
          </div>
        </div>
        <button className="btn primary lg" disabled={!allRequired} onClick={onApproved}>
          {allRequired ? <><Icon name="check" size={14}/> Enviar para análise</> : <><Icon name="upload" size={14}/> {required - done} pendentes</>}
        </button>
      </div>

      <div className="kyc-grid">
        {KYC_DOCS.map(d => (
          <div key={d.id} className={"kyc-doc" + (up[d.id] ? " up" : "")} onClick={() => upload(d.id)}>
            <div className="ico">
              <Icon name={up[d.id] ? "check" : "upload"} size={14}/>
            </div>
            <div>
              <div className="name">{d.name}</div>
              <div className="sub">{d.sub}</div>
            </div>
            <div style={{textAlign: "right"}}>
              <div className="req" style={{color: d.req === "obrigatório" ? "var(--neg)" : d.req === "recomendado" ? "var(--warn)" : "var(--fg-3)"}}>{d.req}</div>
              {up[d.id] && <div className="mono-sm" style={{color: "var(--pos)", marginTop: 4}}>enviado · 2 min</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{marginTop: 14}}>
        <div className="panel-head">
          <div className="left"><Icon name="shield" size={13}/><span>O que acontece depois</span></div>
        </div>
        <div className="panel-body" style={{display: "grid", gap: 10, fontSize: 12.5, lineHeight: 1.5}}>
          <div className="row gap-s"><span className="mono" style={{color: "var(--accent)"}}>1.</span><span>Nosso parceiro de compliance revisa os documentos (até 24h).</span></div>
          <div className="row gap-s"><span className="mono" style={{color: "var(--accent)"}}>2.</span><span>Sua wallet entra na whitelist on-chain — sócios ganham permissão de mint.</span></div>
          <div className="row gap-s"><span className="mono" style={{color: "var(--accent)"}}>3.</span><span>Você define o ticker, supply, vesting e regras de transferência (jurisdição).</span></div>
          <div className="row gap-s"><span className="mono" style={{color: "var(--accent)"}}>4.</span><span>Cria o token, abastece o pool e começa a operar.</span></div>
        </div>
      </div>
    </div>
  );
};

window.KYCFlow = KYCFlow;
