# TreasuryOS — Documento Técnico

> Hackathon: Solana Frontier · Solo · Stack: Next.js 16 + Solana + Anthropic Claude

---

## 1. Visão Geral

**Problema:** Startups em estágio Seed-B acumulam capital em USDC/SOL sem processo formal de tesouraria. Não há treasurer dedicado, não há política de alocação, não há compliance — e o founder descobre o problema quando o runway acaba.

**Solução:** TreasuryOS é um sistema operacional de tesouraria que conecta diretamente à wallet Solana da organização, aplica políticas de alocação configuráveis, sugere movimentos via IA e executa depósitos/resgates em protocolos DeFi — com relatório em PDF e decision log auditável.

**ICP:** Startup Seed-B (~$1–5M em caixa), sem treasurer, que precisa reportar processo para investidores e manter compliance com a política da rodada.

**Demo account:** `dev@capivara.xyz` (senha `Senha@123`) — dados mockados de $847k de tesouraria, sem necessidade de wallet ou saldo devnet.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Detalhe |
|---|---|---|
| Framework | Next.js App Router (Turbopack) | v16.2 |
| API interna | tRPC v11 | context enriquecido com `isDemoUser` |
| Mutations server | Next.js Server Actions | wizard, snapshot, policy, reports |
| ORM | Drizzle ORM + PostgreSQL | 13 tabelas |
| Banco de dados | Supabase Postgres | RLS por org_id |
| Auth | Supabase Auth (email/password + magic link) + SIWS ed25519 | tweetnacl + bs58 |
| Blockchain | Solana devnet · @solana/web3.js · direct Phantom API | sem wallet-adapter-react |
| Indexer | Helius RPC + Enhanced Webhooks | fallback automático para devnet público |
| DeFi | Kamino Lending SDK (devnet) · Mock RWA adapter | serverExternalPackages |
| IA | Anthropic Claude Sonnet 4.6 — streaming + tool-use loop | Opus 4.7 para draft_policy |
| Estilo | Tailwind v4 — design tokens oklch | responsivo, hamburger mobile |
| Export | jsPDF (dynamic import, client-side only) | |
| Deploy | Vercel (gru1 — São Paulo) + Supabase Edge Functions (Deno) | |
| Patch | patch-package — `rpc-websockets/uuid` ESM fix | postinstall automático |

---

## 3. Arquitetura

```
Browser (React)
  │
  ├── Server Components (Next.js App Router)
  │     └── lê DB diretamente via Drizzle (zero round-trip)
  │
  ├── Client Components
  │     ├── tRPC (mutations com optimistic UI)
  │     ├── Server Actions (forms, wizard steps, policy save)
  │     └── fetch /api/copilot (streaming SSE com tool-use loop)
  │
  └── Route Handlers
        ├── /api/trpc/[trpc]       — tRPC handler
        ├── /api/copilot           — streaming Anthropic (tool-use loop)
        ├── /api/setup             — criação de org, link de wallet, config de política
        └── /api/webhooks/helius   — intake eventos onchain

Next.js Server
  └── Drizzle ORM → Supabase Postgres (connection pooler)

Supabase
  ├── Postgres (RLS ativo por org_id)
  ├── Auth (email/password + magic link → callback → session cookie)
  └── Edge Function: snapshot-cron (Deno, pg_cron 5 min)

Solana devnet
  ├── Helius RPC (getBalance + getTokenAccountsByOwner)
  ├── Helius Webhook (enhanced → /api/webhooks/helius)
  ├── Kamino Lending (deposit/withdraw USDC devnet)
  └── Mock RWA (simula Ondo USDY, APR 4.82%, redeem +1d)
```

**Route groups:**
- `(app)` — dashboard, policy, copilot, simulator, execution, reports (auth guard via middleware)
- `(auth)` — login, register, forgot-password, magic link callback
- `(onboarding)` — wizard setup 4 steps

**Decisão de bundling:** Kamino SDK usa imports profundos incompatíveis com Turbopack. Solução: `serverExternalPackages` no `next.config.ts` — Node.js resolve nativamente em runtime.

**ESM fix:** `rpc-websockets` usa `require('uuid')` mas uuid v9+ é ESM puro. Fix via `patch-package`: substitui o require por `crypto.randomBytes` inline. Aplicado em `postinstall` para funcionar no Vercel.

---

## 4. Banco de Dados — 13 Tabelas

```
organizations       — org com perfil (startup/DAO/fund), moeda base, burn mensal
users               — espelho do auth.users + full_name, phone, country
memberships         — org × user × role (owner/admin/viewer)
wallets             — endereços Solana vinculados à org
snapshots           — fotografia do caixa em instante (totals + positions JSON)
policies            — versionadas, status draft/active/archived, regras em JSONB
buckets             — categorias de caixa (operating/payroll/tax/emergency/yield)
obligations         — despesas fixas com vencimento e recorrência
intents             — movimentos aprovados: estado DRAFT→CONFIRMED (state machine)
recommendations     — sugestões do Simulador/Copilot aguardando aprovação
events              — log de eventos onchain recebidos via webhook
audit_log           — log de ações humanas com diff JSON
mock_positions      — posições simuladas no Mock RWA adapter
```

**RLS:** todas as tabelas têm Row Level Security por `org_id`. Trigger `auth.users → public.users` sincroniza o cadastro. `users` inclui `full_name`, `phone`, `country` coletados no registro e upserteados via Server Action.

---

## 5. Rules Engine

Módulo puro TypeScript em `src/lib/rules-engine/` — zero I/O, zero dependências de servidor. Executado tanto no servidor (dashboard, alertas) quanto no cliente (Simulador via `useMemo`, sem round-trip).

### Funções principais

**`projectRunway(snapshot, policy) → ProjectionResult`**
- `liquidRunwayMonths` — meses de caixa líquido com base no burn mensal da org
- `deployedCapitalUsd` / `deployedPct` — capital alocado em protocolos
- `blendedAprPct` — APR médio ponderado das posições ativas
- `estimatedYieldYearUsd` — yield anual estimado
- `complianceScore` — 0–100 baseado em violações de política (penalidades por severidade)
- `violations[]` — regras quebradas com severidade `warn` ou `block`

**`projectScenario(snapshot, policy, deltas) → ProjectionResult`**
Aplica a mesma lógica sobre snapshot hipotético modificado pelos `deltas` (depósitos/saques). Usado no Simulador em tempo real.

**`applyScenarioActions(snapshot, actions) → { liquidUsd, positions }`**
Aplica depósitos/saques ao snapshot e retorna o estado pós-transação. Usado pelo Simulador e pelo `computeRulesValidation` no ExecutionDrawer para validar intents antes de aprovar.

**`estimateMonthlyBurnUsd(snapshot) → number`**
Calcula burn mensal a partir das `obligations` (monthly + quarterly/3 + annual/12). Fallback de 1 para evitar divisão por zero.

**`computeAlerts(snapshot, policy) → TreasuryAlert[]`**
Gera alertas de 4 tipos:
- `runway` — runway líquido abaixo da meta mínima
- `concentration` — % em único protocolo acima do limite
- `policy` — outras violações de regra
- `obligation` — obrigação com vencimento em ≤ 7 dias

**`computeRulesValidation(intent, snapshot, policy) → CheckItem[]`**
Usada no ExecutionDrawer: constrói `ScenarioAction` a partir dos params do intent, chama `applyScenarioActions` + `projectRunway`, mapeia as regras habilitadas para `{ rule, pass, detail }` com valores reais. Substitui validação fake hardcoded.

### Presets de política

| Preset | Runway mín. | Concentração máx. | Liquidez mín. |
|---|---|---|---|
| Conservative | 180d | 30% | 70% |
| Balanced | 90d | 45% | 50% |
| Aggressive | 60d | 60% | 30% |

---

## 6. Funcionalidades — 11 Módulos

### 6.1 Auth

Duas formas de login:
- **Email/senha** — registro com nome completo, telefone, país; validação server-side via Supabase Auth
- **Magic link** — link enviado por email, troca code por session cookie em `/auth/callback`

Middleware Next.js protege todas as rotas `(app)`. Recuperação de senha via `resetPasswordForEmail`.

### 6.2 Onboarding Wizard (4 steps)

`/setup` — Server Component + Client Components; cada step submete via Server Action (`/api/setup`):

1. **Org** — nome + perfil (startup/DAO/fund) + burn mensal → cria `organizations` + `memberships` + `buckets` padrão + policy v1 `balanced`
2. **Wallet** — conecta Phantom via `window.phantom.solana.connect()` → SIWS: nonce → `signMessage` → verifica ed25519 server-side (tweetnacl + bs58) → upsert wallet
3. **Política** — seleciona preset → atualiza `policies`
4. **Buckets** — define targets em USD → atualiza `buckets.target_amount_cents`

### 6.3 Dashboard

Server Component com `force-dynamic` — dados frescos a cada request:
- **KpiGrid** — 4 métricas: total, líquido + runway, deployed + APR, compliance score
- **AlertsBanner** — alertas computados server-side via `computeAlerts`
- **BucketCard** — barra de progresso por categoria; `balanceUsd` lido do `bucketsJson` salvo no snapshot (algoritmo priority-fill — ver seção 10.1)
- **RunwayBar** — barra visual de runway com indicadores de zona (danger/warning/safe)
- **ConcentrationPanel** — donut chart de concentração por protocolo com limite de policy
- **ObligationsPanel** — tabs 30/60/90 dias com total de obrigações por horizonte; CRUD completo (criar, editar, excluir) via Server Actions
- **PositionsTable** — posições alocadas com protocolo, APR, risco, yield acruado
- **SnapshotButton** — tRPC mutation `snapshot.takeManual` → Helius RPC → insere snapshot → `revalidatePath`
- **Module cards** — links clicáveis para os 6 módulos (Policy, Copilot, Simulador, Execução, Equity Studio, Relatórios)

### 6.4 Demo Mode (`dev@capivara.xyz`)

Intercepção por email em **todas** as camadas de dados — sem nenhuma query ao banco:

- `dashboard/page.tsx` → retorna `<DemoDashboard />` antes de qualquer DB query
- `server/context.ts` → `isDemoUser: true`, `orgId = DEMO_ORG_ID` (sem buscar membership)
- `routers/snapshot.ts` → `latest`, `projection`, `takeManual` retornam dados mockados
- `api/copilot/route.ts` → injeta snapshot mockado no contexto do Copilot

Dados mockados (`src/lib/demo/index.ts`):
- Total: $847.200 · Líquido: $312.400 · Kamino: $385.800 @ 5,84% · RWA: $149.000 @ 4,82%
- Runway: 9,8 meses · Compliance: 94/100 · Burn: $85.000/mês

### 6.5 Policy Builder

Layout Bloomberg-style em 2 colunas: preset cards à esquerda, editor de regras à direita.

- **Preset cards** — Conservative / Balanced / Aggressive com métricas ao vivo (min runway, concentração máx., liquidez mín.); seleção muda as regras no painel direito
- **Painel de regras** — toggle por regra + sliders de parâmetros (MIN_RUNWAY_DAYS, MAX_CONCENTRATION_PCT, MIN_LIQUID_PCT, REBALANCE_TRIGGER) e checkboxes (ALLOCATION_WHITELIST)
- `saveAndActivate()` — arquiva policy ativa e insere nova versão como `active`
- **Editor de IA** — textarea em linguagem natural → `policyFromDescription()` Server Action → Claude Sonnet → JSON de regras → strip de markdown fences → `JSON.parse` → aplica no estado local
- **Audit log versionado** — histórico de versões exibido abaixo com timestamp e autor

### 6.6 Copilot (AI Chat)

- Streaming: `fetch /api/copilot` → `response.body.getReader()` → acumula chunks → renderiza em tempo real
- AbortController para botão de parar stream
- Context injetado: snapshot atual + política ativa + projeção
- **Tool-use loop:** `streamCopilotTurn` abre um novo stream após cada turno de tools, executa as tools e continua streamando até `stop_reason === "end_turn"` — garante resposta completa mesmo quando Claude chama `analyze_treasury` antes de responder
- Prompt caching no system prompt — reduz latência ~80% nos turns seguintes

**5 tools:**

| Tool | Função |
|---|---|
| `analyze_treasury` | Diagnóstico completo do estado atual (runway, APR, concentração, violações) |
| `explain_policy` | Explicação em linguagem natural das regras ativas |
| `propose_allocation` | Valida runway mínimo antes de propor qualquer movimento |
| `simulate_scenario` | Executa `projectScenario()` e retorna diff de métricas |
| `draft_policy_from_description` | Descrição em PT-BR → `PolicyRule[]` JSON (usa Claude Opus 4.7) |

### 6.7 Simulador

- Sliders de depósito/saque por adapter (Kamino USDC, Mock RWA)
- Recompute em tempo real via `useMemo` + `projectScenario` — zero round-trip
- **Modo hipotético:** quando `liquidUsd = 0` (wallet devnet sem saldo), ativa automaticamente com $500k padrão — usuário pode digitar qualquer valor; troca o snapshot efetivo mas não afeta o banco
- Delta display: colorido para runway, APR, concentração, compliance
- Botão "Salvar recomendação" → Server Action → insert em `recommendations`
- Painel de violações do cenário com severidade warn/block

### 6.8 Execução

State machine de intents com 9 estados:
```
DRAFT → PROPOSED → APPROVED → QUEUED → SIGNING → BROADCAST → CONFIRMED
                                                              → REJECTED / FAILED
```
- **Modo simulado:** `SIM-<timestamp>` como tx signature, sem interação onchain
- **Modo real:** `buildTx()` → `signAndSend()` via Phantom → `confirmTx()` polling
- **Validação real de regras** — `computeRulesValidation(intent, snapshot, policy)` simula o estado pós-transação via `applyScenarioActions` + `projectRunway` e exibe checkitem por regra habilitada com valores reais (não hardcoded)
- Página busca snapshot + policy ativos em paralelo e injeta em `ExecutionClient` → `ExecutionDrawer`
- Exibe "Sem snapshot" / "Sem política ativa" quando dados faltam — nunca mente sobre compliance
- Exibe histórico de execuções com status e tx signature

### 6.9 Tour Guiado

Componente `Tour.tsx` — guia o usuário página a página em ~60 segundos no primeiro acesso.

- **6 passos** com `href`, `label`, `icon`, `title`, `body`: Dashboard → Policy → Copilot → Simulator → Execution → Reports
- **Navegação real:** `useRouter().push(STEPS[step].href)` — não é modal sobreposto; navega de verdade entre rotas
- **`navigating` state** bloqueia duplo-clique; limpa quando `usePathname() === STEPS[step].href`
- **localStorage** persiste `{ done: boolean, step: number }` — retoma de onde parou no reload
- **AutoStart** — abre automaticamente para demo users no primeiro acesso (sem `tourDone` salvo)
- **Card fixo** no canto inferior direito com chips de passo, barra de progresso e botão "Next label →"
- Botão "Tour" no AppShell reabre a qualquer momento

### 6.10 Equity Studio

Módulo de distribuição de dividendos em USDC para holders do token da empresa.

- Configura snapshot de holders: endereço do token, data de corte
- Define valor a distribuir e data de pagamento
- Execução on-chain auditável — cada distribuição gera registro em `events`
- Token-gated: somente holders verificados recebem a distribuição

### 6.11 Relatórios

- **Decision Log:** timeline mesclada de `audit_log` + `events`, ordenada por data
- **Resumo Executivo:** Server Action chama Claude Sonnet 4.6 com todos os KPIs → texto PT-BR ≤150 palavras, tom direto para o founder
- **PDF Export:** jsPDF (dynamic import) → A4 com header, KPIs em grid 2 colunas, tabela de posições, violações, resumo executivo, rodapé com hash do snapshot

### 6.12 Auto-Snapshots + Webhook

**Supabase Edge Function** (`supabase/functions/snapshot-cron/index.ts`, runtime Deno):
- Agendada a cada 5 min via `pg_cron`
- Busca todas as wallets primárias cadastradas
- Helius RPC: `getBalance` + `getTokenAccountsByOwner`
- Insere snapshot por org automaticamente

**Helius Webhook** (`/api/webhooks/helius`):
- Autenticado com `Authorization: Bearer <HELIUS_WEBHOOK_SECRET>`
- Qualquer transação nos endereços monitorados → registra evento + dispara snapshot imediato

---

## 7. Fluxo Completo do Sistema

```
1. Registro / Login
   └── email/password ou magic link → /auth/callback → session

2. Onboarding (primeira vez)
   └── org → Phantom SIWS → política preset → targets de bucket

3. Dashboard
   └── Snapshot manual (tRPC) ou automático (cron/webhook)
       └── AlertsBanner mostra violações e obrigações urgentes

4. Policy Builder
   └── Ajustar regras manualmente OU descrever em português → IA gera JSON

5. Copilot
   └── "Analise minha tesouraria" → IA chama analyze_treasury → diagnóstico completo

6. Simulador
   └── Sliders (ou modo hipotético) → projeção real-time → Salvar recomendação

7. Execução
   └── Recomendação → Aprovar intent → Assinar com Phantom → Confirmar onchain

8. Relatórios
   └── Gerar resumo executivo (IA) → Exportar PDF auditável
```

---

## 8. Integração Solana

### Phantom — Conexão Direta

Usa `window.phantom.solana` diretamente, sem `@solana/wallet-adapter-react`:

```typescript
// src/lib/solana/wallet.tsx
function getPhantom(): PhantomSolana | null {
  const p = (window as { phantom?: { solana?: PhantomSolana } }).phantom?.solana;
  return p?.isPhantom ? p : null;
}

async function connect() {
  const phantom = getPhantom();
  const { publicKey } = await phantom.connect();
  return publicKey.toString();
}
```

Elimina o problema de timing do `select()` + `connect()` do wallet-adapter-react.

### SIWS (Sign In With Solana)

```
Cliente:  window.phantom.solana.connect() → signMessage(nonce)
Servidor: bs58.decode(address) → tweetnacl.sign.detached.verify(msg, sig, pubkey)
          → upsert wallet no DB
```

Usa `bs58` em vez de `@solana/web3.js/PublicKey` para evitar ESM issues no servidor.

### Helius RPC

- `getBalance` — saldo SOL em lamports
- `getTokenAccountsByOwner` — saldo USDC devnet (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- Fallback para `https://api.devnet.solana.com` se env não definida
- Imports de `@solana/web3.js` sempre dentro de funções (`await import(...)`) para evitar registro Turbopack em tempo de inicialização

### Kamino Lending SDK

- Adapter: `KaminoUsdcAdapter` em `src/lib/adapters/kamino.ts`
- Market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF` (devnet)
- Métodos: `deposit(amountUsd)`, `withdraw(amountUsd)`, `readPosition(pubkey)`, **`quote(0)` — busca APR real do mercado Kamino; fallback 5.84% se RPC falhar**
- `takeSnapshot()` chama `quote(0)` em `Promise.allSettled` em paralelo com `readPosition` — APR salvo no `positionsJson` é sempre o do mercado
- Externalizado via `serverExternalPackages` no `next.config.ts`

### Mock RWA Adapter

- Simula ativo tipo Ondo USDY — APR fixo 4.82%
- Redeem delay de 1 dia (campo `redeemable_at` em `mock_positions`)
- Persiste posições em `mock_positions` no DB

---

## 9. IA — Anthropic Claude

### Copilot — Tool-Use Loop com Streaming

```typescript
// src/lib/agent/client.ts
export async function* streamCopilotTurn(ctx, history, userMessage) {
  const messages = [...history, { role: "user", content: userMessage }];

  while (true) {
    const stream = anthropic.messages.stream({ model: SONNET, tools, messages });

    // Stream texto em tempo real
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta")
        yield event.delta.text;
    }

    const final = await stream.finalMessage();
    if (final.stop_reason !== "tool_use") break;  // resposta completa

    // Executa tools e adiciona resultados
    const results = await Promise.all(toolUseBlocks.map(executeToolCall));
    messages.push({ role: "assistant", content: final.content });
    messages.push({ role: "user",      content: toolResults });
    // Loop continua → próximo stream envia a resposta final com dados das tools
  }
}
```

### Policy from Description — JSON Robusto

```typescript
const raw = response.content.map((b) => b.text).join("").trim();
// Strip markdown code fences caso Claude os inclua
const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
const parsed = JSON.parse(text);
```

### Modelos usados

| Caso | Modelo | Motivo |
|---|---|---|
| Copilot chat + streaming | claude-sonnet-4-6 | Latência + custo |
| Draft policy from description | claude-opus-4-7 | Qualidade do JSON gerado |
| Executive summary (reports) | claude-sonnet-4-6 | Qualidade suficiente, mais rápido |
| Policy from description (policy page) | claude-sonnet-4-6 | Server Action sem streaming |

### Prompt caching

System prompt (snapshot + política) tem `cache_control: { type: "ephemeral" }`. Após o primeiro turn da sessão, o cache fica warm por 5 min — reduz custo e latência ~80% nas mensagens seguintes.

---

## 10. Segurança e Consistência de Dados

### 10.1 Algoritmo de Alocação de Buckets

`allocateBuckets(liquidUsd, orgBuckets)` em `dashboard/actions.ts` — priority-fill no momento do snapshot:

```typescript
const BUCKET_PRIORITY = ["operating", "payroll", "tax", "emergency", "yield", "custom"];
// operating e payroll → min(targetUsd, remaining)
// yield e custom → absorvem todo o restante
// buckets mais prioritários preenchem primeiro
```

Resultado salvo em `snapshots.bucketsJson` como `{ kind, balanceUsd, targetUsd }[]`. Lido em `buildSnapshot()` no `dashboard/page.tsx` e `simulator/page.tsx` via `balanceByKind.get(b.kind) ?? 0` — fallback para snapshots antigos que tinham `{}`.

### 10.2 IDOR — Defense in Depth

Todas as mutations em `execution/actions.ts` incluem `orgId` na cláusula WHERE das UPDATEs:

```typescript
// approveIntent e executeSimulated:
.where(and(eq(intents.id, intentId), eq(intents.orgId, orgId)));
```

Sem esse segundo predicado, um usuário autenticado em outra org poderia aprovar ou executar intents de terceiros (TOCTOU entre o READ de validação e o UPDATE).

### 10.3 Idempotência de Intents

`approveScenario()` em `simulator/actions.ts` usa hash determinístico SHA-256 com janela de 5 minutos:

```typescript
function intentKey(orgId, action, index): string {
  const window = Math.floor(Date.now() / (5 * 60_000));
  const raw = `${orgId}:${action.kind}:${action.adapterId}:${action.amountUsd}:${window}:${index}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
// INSERT com .onConflictDoNothing() absorve retries dentro da mesma janela
```

### 10.4 Demo Guard

Todas as Server Actions e Route Handlers verificam `isDemoUser(user.email)` antes de qualquer write no DB. Demo users retornam `{ ok: true }` sem efeitos colaterais.

---

## 11. Responsividade e UX

### AppShell — Sidebar Responsiva

```
Desktop (md+): sidebar fixa de 208px, sempre visível
Mobile:        sidebar ausente — hamburger no top bar
               → clique abre sidebar como overlay (fixed, z-40)
               → backdrop semitransparente fecha ao clicar fora
               → links de nav fecham o overlay automaticamente
```

### ProfilePanel

Modal deslizante pelo avatar do usuário na sidebar:
- Exibe nome, email, org, role
- Seção de wallet: mostra endereço vinculado ou botão de conectar Phantom + SIWS
- Dinâmico (`ssr: false`) para evitar SSR dos hooks de wallet

---

## 12. Deploy e Infraestrutura

```
Vercel
├── Região: gru1 (São Paulo)
├── Build: next build (Turbopack)
├── postinstall: patch-package (aplica patch rpc-websockets antes de deploy)
├── Env vars: via dashboard
└── URL: https://treasury-os-black.vercel.app

Supabase
├── Projeto: joeyutliqcqcefeidsdf
├── RLS: ativo em todas as tabelas
├── Auth: email/password + magic link habilitados
│         Redirect: https://treasury-os-black.vercel.app/auth/callback
└── Edge Function: snapshot-cron (Deno)
    └── pg_cron: SELECT cron.schedule('*/5 * * * *', ...)

GitHub
└── https://github.com/Nogcrypto/treasury_os  [master → auto-deploy Vercel]
```

---

## 13. Estrutura de Arquivos

```
src/
├── app/
│   ├── (app)/           — rotas autenticadas
│   │   ├── dashboard/   — page.tsx + actions.ts
│   │   ├── policy/      — page.tsx + actions.ts
│   │   ├── copilot/     — page.tsx + actions.ts
│   │   ├── simulator/   — page.tsx + actions.ts
│   │   ├── execution/   — page.tsx + actions.ts + ExecutionClient.tsx
│   │   ├── equity-studio/ — page.tsx
│   │   └── reports/     — page.tsx + actions.ts
│   ├── (auth)/
│   │   ├── login/       — page.tsx + actions.ts
│   │   ├── register/    — page.tsx + actions.ts
│   │   ├── forgot-password/ — page.tsx + actions.ts
│   │   └── callback/    — route.ts (Supabase OAuth callback)
│   ├── (onboarding)/setup/ — page.tsx + actions.ts
│   └── api/
│       ├── copilot/     — route.ts (streaming + tool-use loop)
│       ├── setup/       — route.ts (createOrg, linkWallet, setOrgPreset, updateBuckets)
│       ├── trpc/[trpc]/ — route.ts
│       └── webhooks/helius/ — route.ts
├── components/
│   ├── AppShell.tsx          — sidebar responsiva (hamburger mobile) + botão Tour
│   ├── AlertsBanner.tsx      — 4 tipos de alerta
│   ├── Copilot.tsx           — chat streaming UI + abort
│   ├── ExecutionDrawer.tsx   — state machine de intents + computeRulesValidation real
│   ├── MarketTicker.tsx      — ticker de preços de mercado
│   ├── PdfExportButton.tsx   — jsPDF export (dynamic import)
│   ├── PolicyBuilder.tsx     — Bloomberg-style 2 colunas + geração por IA
│   ├── ProfilePanel.tsx      — modal de perfil + wallet connect
│   ├── Simulator.tsx         — sliders + modo hipotético + projeção real-time
│   ├── Tour.tsx              — guia página a página + router.push + localStorage
│   ├── WalletButton.tsx      — botão de conexão Phantom standalone
│   ├── dashboard/            — KpiGrid, BucketCard, PositionsTable, SnapshotButton
│   │                           RunwayBar, ConcentrationPanel, ObligationsPanel
│   └── onboarding/           — SetupWizard (4 steps + direct Phantom API)
├── lib/
│   ├── adapters/        — interface + kamino.ts + mock-rwa.ts
│   ├── agent/           — client.ts (tool-use loop) · tools.ts · prompts.ts
│   ├── db/              — schema.ts (13 tabelas) · client.ts
│   ├── demo/            — index.ts (dados mockados para dev@capivara.xyz)
│   ├── rules-engine/    — types · policy (presets) · projections · alerts · validation
│   ├── solana/          — wallet.tsx (direct Phantom) · siws.ts (bs58) · indexer.ts · tx.ts
│   └── supabase/        — client.ts · server.ts
└── server/
    ├── trpc.ts          — contexto (isDemoUser, userEmail, orgId) · procedures
    └── routers/         — org · snapshot · bucket · obligation · policy
                           intent · recommendation
patches/
└── rpc-websockets+9.3.9.patch   — substitui require('uuid') por crypto.randomBytes
supabase/
└── functions/snapshot-cron/index.ts  — Deno edge function
drizzle/
├── migrations/0000_initial.sql       — schema completo (13 tabelas)
├── migrations/0002_users_profile_fields.sql  — full_name, phone, country
└── seed.sql
docs/
├── PLAN.md
├── Backlog.md
└── TECHNICAL.md  ← este arquivo   (atualizado com Tour, bucket fix, rules reais, segurança)
```

---

## 14. Variáveis de Ambiente

```env
# Supabase
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Helius
HELIUS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_WEBHOOK_SECRET=<64-char hex — openssl rand -hex 32>

# App
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```
