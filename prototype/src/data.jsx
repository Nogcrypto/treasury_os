/* TreasuryOS — mock data fixtures */

const ORG = {
  name: "Capivara Labs",
  ticker: "CAPI",
  symbol: "CAPI",
  profile: "Startup web3",
  wallet: "8xZk…N3qP",
  fullWallet: "8xZkhpN5fA2vRtQ7Y9HmEbW3CkP4nL6dN3qP",
  network: "Solana Devnet",
  cluster: "devnet"
};

const TICKER_ITEMS = [
  { sym: "USDC/USD",  v: "1.0001",  d: "+0.01%", pos: true },
  { sym: "SOL/USD",   v: "184.32",  d: "+2.18%", pos: true },
  { sym: "JTO",       v: "3.41",    d: "-1.04%", pos: false },
  { sym: "KAMINO USDC APR", v: "5.84%", d: "+12bps", pos: true },
  { sym: "USDY APR",  v: "4.82%",   d: "+0bps",  pos: true },
  { sym: "SOL TPS",   v: "3,182",   d: "live",   pos: true },
  { sym: "BR-CDI",    v: "11.65%",  d: "—", pos: true },
  { sym: "CAPI/USDC", v: "0.412",   d: "+4.20%", pos: true },
  { sym: "TVL POOL",  v: "$842k",   d: "+1.84%", pos: true },
  { sym: "TREASURY",  v: "$812,440", d: "+0.32%", pos: true },
  { sym: "RUNWAY",    v: "6.8 mo",  d: "+0.2",   pos: true },
];

const KPIS = [
  { k: "Total treasury",   v: "812,440",   unit: "USDC", delta: "+1.4% 7d", pos: true,  spark: "up",   tip: "Soma de todos os ativos da tesouraria convertidos em USDC. Inclui caixa em wallets + posições alocadas em protocolos." },
  { k: "Liquid runway",    v: "6.8",       unit: "MESES", delta: "vs 6.6 política", pos: true, spark: "flat", tip: "Quantos meses a empresa opera com o caixa atual considerando o burn mensal de 120k. Inclui posições resgatáveis em até 24h." },
  { k: "Protected runway", v: "4.0",       unit: "MESES", delta: "meta 4.0",  pos: true, spark: "flat", tip: "Meses garantidos em ativos sem risco de mercado (USDC + T-bills tokenizadas). É o mínimo que a política exige preservar." },
  { k: "Deployed capital", v: "320,000",   unit: "USDC", delta: "39.4% do total", pos: true, spark: "up", tip: "USDC alocado em protocolos para gerar yield (Kamino, MarginFi, RWA tokenizadas). O resto está em caixa líquido." },
  { k: "Yield estimado",   v: "5.42",      unit: "% APR", delta: "blend 320k",  pos: true, spark: "up", tip: "Taxa anualizada (blend) do capital alocado, ponderada por posição. Estimado, varia por protocolo e utilização." },
  { k: "Próximas obrig.",  v: "168,500",   unit: "USDC", delta: "30 dias",     pos: false, spark: "down", tip: "Total de pagamentos previstos nos próximos 30 dias: folha, fornecedores, impostos. Sai do bucket apropriado automaticamente." },
  { k: "Concentration",    v: "62",        unit: "% USDC", delta: "limite 70%", pos: true, spark: "flat", tip: "% do capital alocado no maior protocolo único. Limite de 70% evita risco sistêmico — se o protocolo cair, perda é limitada." },
  { k: "Compliance",       v: "94",        unit: "/100",  delta: "+6 vs sem.", pos: true, spark: "up", tip: "Score de aderência à política ativa. Penaliza violações de runway mínimo, concentração, whitelist e outras regras." },
];

const BUCKETS = [
  { kind: "operating", name: "Operacional",  sub: "burn 120k/mês • 60d cobertos", balance: 240000, target: 240000, color: "var(--fg-1)" },
  { kind: "payroll",   name: "Folha",        sub: "todo dia 5 • 18 colaboradores", balance: 88500,  target: 96000,  color: "var(--accent-2)" },
  { kind: "tax",       name: "Impostos",     sub: "trimestral • próximo 15/jul",   balance: 64000,  target: 72000,  color: "var(--warn)" },
  { kind: "emergency", name: "Reserva",      sub: "4 meses • mín. política",       balance: 100000, target: 100000, color: "var(--accent-3)" },
  { kind: "yield",     name: "Excedente",    sub: "alocável conforme política",    balance: 319940, target: 0,      color: "var(--accent)" },
];

const POSITIONS = [
  { id: "kamino", protocol: "Kamino", asset: "USDC", strategy: "Lending", amount: 250000, apr: 5.84, accrued: 218.40, risk: 1, days: 12 },
  { id: "rwa",    protocol: "Mock RWA (USDY-like)", asset: "USDY", strategy: "T-Bills", amount: 70000,  apr: 4.82, accrued: 41.20, risk: 2, days: 9 },
];

const CONCENTRATION = [
  { name: "USDC livre", pct: 60.6, color: "var(--accent)", v: 492500 },
  { name: "Kamino USDC", pct: 30.8, color: "var(--accent-2)", v: 250000 },
  { name: "Mock RWA",  pct: 8.6,  color: "var(--accent-3)", v: 70000 },
];

const OBLIGATIONS = [
  { when: "05 JUN", label: "Folha de pagamento", sub: "payroll · 18 colaboradores", v: "−96,000", level: "" },
  { when: "12 JUN", label: "Vendor — Helius infra", sub: "operating · mensal", v: "−12,500", level: "" },
  { when: "20 JUN", label: "AWS + Vercel", sub: "operating", v: "−6,800", level: "" },
  { when: "30 JUN", label: "Recebível Series A2", sub: "inflow · USDC", v: "+250,000", level: "" },
  { when: "05 JUL", label: "Folha de pagamento", sub: "payroll", v: "−96,000", level: "" },
  { when: "15 JUL", label: "Imposto trimestral", sub: "tax · estimado", v: "−54,000", level: "warn" },
];

const POLICIES = [
  { id: "conservative", name: "Conservadora",
    desc: "4 meses protegidos. 30% máx por protocolo. Apenas excedente alocável.",
    runway: 4, conc: 30, liquid: 70, sel: false },
  { id: "balanced", name: "Balanceada",
    desc: "3 meses protegidos. 45% máx por protocolo. Yield em 2 níveis.",
    runway: 3, conc: 45, liquid: 50, sel: true },
  { id: "aggressive", name: "Agressiva",
    desc: "2 meses protegidos. 60% máx por protocolo. Inclui RWA tier 2.",
    runway: 2, conc: 60, liquid: 35, sel: false },
];

const RULES = [
  { id: "MIN_RUNWAY_DAYS",       label: "Runway mínimo protegido",       desc: "dias de operação cobertos por reserva", v: "120 dias", on: true },
  { id: "MAX_CONCENTRATION_PCT", label: "Concentração máxima por protocolo", desc: "exposição máxima a um adapter",  v: "30%",      on: true },
  { id: "MIN_LIQUID_PCT",        label: "Mínimo líquido",                 desc: "% mantido em USDC sem lock-up",       v: "50%",      on: true },
  { id: "BUCKET_TARGET",         label: "Metas por bucket",               desc: "operating, payroll, tax, emergency",  v: "5 ativos", on: true },
  { id: "ALLOCATION_WHITELIST",  label: "Whitelist de adapters",          desc: "protocolos permitidos para alocação", v: "Kamino, USDY", on: true },
  { id: "YIELD_ONLY_EXCESS",     label: "Yield apenas no excedente",      desc: "buckets protegidos não rendem",       v: "ativo",    on: true },
  { id: "REBALANCE_TRIGGER",     label: "Trigger de rebalance",           desc: "% de desvio que dispara recomendação", v: "8%",       on: false },
];

const COPILOT_TOOLS = [
  { id: "analyze_treasury",       name: "analyze_treasury",       sub: "Sonnet 4.6 · cached" },
  { id: "draft_policy",           name: "draft_policy_from_text", sub: "Opus 4.7" },
  { id: "explain_policy",         name: "explain_policy",         sub: "Sonnet 4.6" },
  { id: "propose_allocation",     name: "propose_allocation",     sub: "Opus 4.7 · w/ guardrails" },
  { id: "simulate_scenario",      name: "simulate_scenario",      sub: "Sonnet 4.6 · pure fn" },
];

const COPILOT_SUGGESTS = [
  "Analisar tesouraria e identificar excedente ocioso",
  "Quero 4 meses protegidos, sem mais de 30% num protocolo",
  "Simular alocação de 250k em Kamino + 70k em RWA",
  "Resumir últimos 7 dias para o board",
];

const COPILOT_THREAD = [
  {
    role: "ai",
    meta: ["analyze_treasury()", "Sonnet 4.6", "284 tokens · cached"],
    body: [
      { p: "Identifiquei <strong>USDC 319.940</strong> ocioso acima do runway mínimo. Concentração atual em USDC livre é <strong>60.6%</strong>, dentro do limite, mas não há yield acumulando." },
      { p: "Sugestões: ativar política <strong>Conservadora</strong>, alocar excedente em <strong>2 tiers</strong> respeitando seu limite de 30% por protocolo." },
    ],
  },
  {
    role: "user",
    body: [{ p: "Quero 4 meses protegidos, sem mais de 30% num protocolo. Aplica só o excedente." }],
  },
  {
    role: "ai",
    meta: ["draft_policy_from_text()", "Opus 4.7"],
    tool: {
      name: "draft_policy_from_description",
      args: { text: "4 meses protegidos, sem mais de 30% num protocolo, aplica só o excedente" },
      result: { MIN_RUNWAY_DAYS: 120, MAX_CONCENTRATION_PCT: 30, YIELD_ONLY_EXCESS: true, MIN_LIQUID_PCT: 50 },
    },
    body: [
      { p: "Gerei a policy v3. Validação determinística: <strong>OK</strong> (rules-engine · 7/7 regras consistentes)." },
    ],
    rationale: {
      title: "Recomendação · 320,000 USDC",
      actions: [
        { n: 1, label: "Depositar 250,000 USDC em Kamino", sub: "lending · APR 5.84% · risk tier 1", v: "+$1,217/mo" },
        { n: 2, label: "Depositar 70,000 USDY (RWA)",      sub: "T-Bills · APR 4.82% · risk tier 2", v: "+$281/mo" },
      ],
      footer: "Compliance score projetado: 94 → 98 · runway protegido: 4.0 → 4.0 meses",
    },
  },
];

const TX_STEPS = [
  { id: "DRAFT",     label: "Draft",     when: "12:04:11" },
  { id: "PROPOSED",  label: "Proposed",  when: "12:04:11" },
  { id: "APPROVED",  label: "Approved by você", when: "12:04:38" },
  { id: "QUEUED",    label: "Queued",    when: "12:04:38" },
  { id: "SIGNING",   label: "Signing (Phantom)", when: "12:04:42" },
  { id: "BROADCAST", label: "Broadcast → devnet", when: "12:04:44" },
  { id: "CONFIRMED", label: "Confirmed",  when: "12:04:46" },
];

const ALERTS = [
  { kind: "warn", title: "Imposto trimestral em 41 dias", sub: "tax bucket abaixo da meta em USDC 8,000" },
  { kind: "ok",   title: "Compliance subiu para 94/100",  sub: "após ativação da policy v3" },
  { kind: "warn", title: "Kamino APR caiu 12bps",        sub: "rebalance trigger em 8% ainda não atingido" },
];

// ── Token Studio ────────────────────────────────────
const TOKEN = {
  symbol: "CAPI",
  name: "Capivara Labs Equity Token",
  supply: 10000000,
  circulating: 1850000,
  treasury: 4500000,
  team: 2000000,
  pool: 1650000,
  price: 0.412,
  fdv: 4120000,
  poolTvl: 842300,
  poolPair: "CAPI/USDC",
  vol24: 184500,
  holders: 312,
  dividends: { totalPaid: 24500, lastEpoch: "2026-04-30", apr: 6.4 },
};

const TOKEN_HOLDERS = [
  { name: "Treasury (CAPI)", addr: "8xZk…N3qP",  pct: 45.0, v: 4500000, role: "Treasury" },
  { name: "Team / Founders", addr: "Vesting",     pct: 20.0, v: 2000000, role: "Vested 36mo" },
  { name: "Liquidity Pool",  addr: "Pool · Raydium-like", pct: 16.5, v: 1650000, role: "AMM 50/50" },
  { name: "Angel · 0xLuna",  addr: "Hk2m…W4tB",  pct: 4.2,  v: 420000,  role: "Investor" },
  { name: "Builder · seedclub", addr: "9AbX…q1zK", pct: 2.8, v: 280000,  role: "Investor" },
  { name: "Pública (312)",   addr: "—",            pct: 11.5, v: 1150000, role: "Holders" },
];

const POOL_TRADES = [
  { t: "12:42:18", side: "buy",  amount: "1,820 CAPI", usdc: "750.10",  who: "Hk2m…W4tB" },
  { t: "12:38:04", side: "sell", amount: "904 CAPI",   usdc: "372.45",  who: "9AbX…q1zK" },
  { t: "12:31:55", side: "buy",  amount: "5,000 CAPI", usdc: "2,060.00", who: "F7nQ…tt93" },
  { t: "12:24:11", side: "buy",  amount: "120 CAPI",   usdc: "49.44",   who: "8Wpq…m2Pr" },
  { t: "12:18:02", side: "sell", amount: "2,400 CAPI", usdc: "988.80",  who: "Vex9…e1Tg" },
];

window.TOS = {
  ORG, TICKER_ITEMS, KPIS, BUCKETS, POSITIONS, CONCENTRATION, OBLIGATIONS,
  POLICIES, RULES, COPILOT_TOOLS, COPILOT_SUGGESTS, COPILOT_THREAD,
  TX_STEPS, ALERTS, TOKEN, TOKEN_HOLDERS, POOL_TRADES
};
