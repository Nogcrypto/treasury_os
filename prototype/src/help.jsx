/* Help, Tooltip, Tour primitives */

const Tooltip = ({ text, children }) => (
  <span className="info-pill" tabIndex="0">
    ?
    <span className="pop">{text}</span>
  </span>
);

const HelpBanner = ({ title, children, onDismiss }) => (
  <div className="help-banner">
    <div className="ico"><Icon name="info" size={13}/></div>
    <div className="body">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
    {onDismiss && <button className="x" onClick={onDismiss} title="Ocultar"><Icon name="x" size={13}/></button>}
  </div>
);

// Tour: anchored cards highlighting different parts of the app
const TOUR_STEPS = [
  {
    view: "dashboard",
    title: "Bem-vindo ao TreasuryOS",
    body: "Este é o cockpit. Cada bloco aqui responde uma pergunta: quanto tem, por quanto tempo dura, o que está rendendo e onde há risco. Vamos passar por cada parte da plataforma em 60 segundos.",
    pos: { top: 110, left: 260 },
  },
  {
    view: "dashboard",
    title: "KPIs · 8 números essenciais",
    body: "Total de caixa, runway (quantos meses sua empresa opera com o que tem), runway protegido (quanto está fora de risco), capital alocado, yield estimado, próximas obrigações, concentração e compliance da política. Passe o mouse no "?" para entender cada termo.",
    pos: { top: 220, left: 280 },
  },
  {
    view: "policy",
    title: "Policy Engine · regras da casa",
    body: "Aqui você define a política da tesouraria: runway mínimo, concentração máxima, whitelist de protocolos. A IA propõe; estas regras determinísticas validam antes de virar transação onchain.",
    pos: { top: 200, left: 320 },
  },
  {
    view: "copilot",
    title: "AI Copilot · explica em PT, age com guardrails",
    body: "Converse em linguagem natural. O copiloto chama tools (analyze, draft_policy, propose_allocation, simulate). Toda ação proposta passa pelo rules-engine antes de ser oferecida para você aprovar.",
    pos: { top: 220, left: 320 },
  },
  {
    view: "simulator",
    title: "Simulador · antes/depois sem assinar nada",
    body: "Mexa nos sliders e veja o impacto em runway, yield e concentração em tempo real. Compara baseline com até 2 cenários. Nada vai onchain até você aprovar explicitamente.",
    pos: { top: 220, left: 320 },
  },
  {
    view: "execution",
    title: "Execução · da intent à confirmação",
    body: "Cada ação vira uma intent com state machine. Você assina no Phantom (ou usa modo simulado para demo). Idempotency key e validação de regras evitam erros e duplicações.",
    pos: { top: 200, left: 320 },
  },
  {
    view: "tokenstudio",
    title: "Equity Studio · sua empresa, tokenizada",
    body: "Aqui PMEs e DAOs emitem o token de equity da empresa, montam o pool de liquidez e distribuem dividendos onchain. Antes de mintar, passamos por um KYC empresarial leve para manter compliance.",
    pos: { top: 200, left: 320 },
  },
  {
    view: "dashboard",
    title: "Pronto. É seu.",
    body: "Você pode reabrir este tour a qualquer momento pelo botão "Tour" no topo. Dúvidas pontuais? Passe o mouse sobre qualquer "?" na interface.",
    pos: { top: 110, left: 260 },
  },
];

const Tour = ({ step, total, onNext, onPrev, onClose, data }) => (
  <>
    <div className="tour-backdrop" onClick={onClose}></div>
    <div className="tour-card" style={{ top: data.pos.top, left: data.pos.left }}>
      <div className="step-label">Tour · {step + 1} / {total}</div>
      <h3>{data.title}</h3>
      <p>{data.body}</p>
      <div className="pips">
        {Array.from({length: total}).map((_, i) => (
          <div key={i} className={"pip" + (i <= step ? " on" : "")}></div>
        ))}
      </div>
      <div className="foot">
        <button className="btn sm" onClick={onClose}>Pular tour</button>
        <div className="row gap-s">
          {step > 0 && <button className="btn sm" onClick={onPrev}>Voltar</button>}
          <button className="btn primary sm" onClick={onNext}>
            {step === total - 1 ? "Concluir" : "Próximo"} <Icon name="arrowRight" size={11}/>
          </button>
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, { Tooltip, HelpBanner, Tour, TOUR_STEPS });
