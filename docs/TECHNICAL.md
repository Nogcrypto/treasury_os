# TreasuryOS — Documento Técnico

> Hackathon: Solana Frontier · Solo · Stack: Next.js 16 + Solana + Anthropic Claude

---

## 1. Visão Geral

**Problema:** Startups em estágio Seed-B acumulam capital em USDC/SOL sem processo formal de tesouraria. Não há treasurer dedicado, não há política de alocação, não há compliance — e o founder descobre o problema quando o runway acaba.

**Solução:** TreasuryOS é um sistema operacional de tesouraria que conecta diretamente à wallet Solana da organização, aplica políticas de alocação configuráveis, sugere movimentos via IA e executa depósitos/resgates em protocolos DeFi — com relatório em PDF e decision log auditável.

**ICP:** Startup Seed-B (~$1–5M em caixa), sem treasurer, que precisa reportar processo para investidores e manter compliance com a política da rodada.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js App Router (Turbopack) | 16.2 |
| API interna | tRPC | v11 |
| Mutations server | Next.js Server Actions | — |
| ORM | Drizzle ORM + PostgreSQL | — |
| Banco de dados | Supabase Postgres | — |
| Auth | Supabase Auth (magic link) + SIWS ed25519 | — |
| Blockchain | Solana devnet · @solana/web3.js · wallet-adapter · Phantom | — |
| Indexer | Helius RPC + Enhanced Webhooks | — |
| DeFi | Kamino Lending SDK (devnet) · Mock RWA adapter | — |
| IA | Anthropic Claude Sonnet 4.6 — streaming + tool use | — |
| Estilo | Tailwind v4 — design tokens oklch, `@theme inline` | — |
| Export | jsPDF (dynamic import, client-side only) | — |
| Deploy | Vercel (gru1 — São Paulo) + Supabase Edge Functions (Deno) | — |

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
  │     ├── Server Actions (forms, wizard steps)
  │     └── fetch /api/copilot (streaming SSE)
  │
  └── Route Handlers
        ├── /api/trpc/[trpc]       — tRPC handler
        ├── /api/copilot           — streaming Anthropic
        └── /api/webhooks/helius   — intake eventos onchain

Next.js Server
  └── Drizzle ORM → Supabase Postgres (connection pooler Supabase)

Supabase
  ├── Postgres (RLS ativo por org_id)
  ├── Auth (magic link → callback → session cookie)
  └── Edge Function: snapshot-cron (Deno, pg_cron 5 min)

Solana devnet
  ├── Helius RPC (getBalance + getTokenAccountsByOwner)
  ├── Helius Webhook (enhanced → /api/webhooks/helius)
  ├── Kamino Lending (deposit/withdraw USDC devnet)
  └── Mock RWA (simula Ondo, APR 4.82%, redeem +1d)
```

**Route groups:**
- `(app)` — dashboard, policy, copilot, simulator, execution, reports (auth guard via middleware)
- `(auth)` — login, magic link callback
- `(onboarding)` — wizard setup 4 steps

**Decisão de bundling:** Kamino SDK usa imports profundos (`@kamino-finance/farms-sdk/dist/@codegen/...`) incompatíveis com Turbopack. Solução: `serverExternalPackages` no `next.config.ts` — o Node.js resolve nativamente em runtime sem bundlar.

---

## 4. Banco de Dados — 12 Tabelas

```
organizations       — org com perfil, moeda base, burn mensal
users               — espelho do auth.users do Supabase
memberships         — org × user × role (owner/admin/viewer)
wallets             — endereços Solana vinculados à org
snapshots           — fotografia do caixa em um instante (totals + positions JSON)
policies            — versionadas, status draft/active/archived, regras em JSONB
buckets             — categorias de caixa (operating/payroll/tax/emergency/yield)
obligations         — despesas fixas com vencimento e recorrência
intents             — movimentos aprovados: estado DRAFT→CONFIRMED (state machine)
recommendations     — sugestões do Simulador/Copilot aguardando aprovação
events              — log de eventos onchain recebidos via webhook
audit_log           — log de ações humanas com diff JSON
mock_positions      — posições simuladas no Mock RWA adapter
```

**RLS:** todas as tabelas têm Row Level Security por `org_id`. Um trigger `auth.users → public.users` sincroniza o cadastro.

---

## 5. Rules Engine

Módulo puro TypeScript em `src/lib/rules-engine/` — zero I/O, zero dependências de servidor. Pode ser executado tanto no servidor quanto no cliente (Simulador usa client-side).

### Funções principais

**`projectRunway(snapshot, policy) → ProjectionResult`**
Calcula a partir de um snapshot:
- `liquidRunwayMonths` — meses de caixa líquido
- `deployedCapitalUsd` / `deployedPct` — capital alocado em protocolos
- `blendedAprPct` — APR médio ponderado das posições
- `estimatedYieldYearUsd` — yield anual estimado
- `complianceScore` — 0–100 baseado em violações de política
- `violations[]` — lista de regras quebradas com severidade (warn/block)

**`projectScenario(snapshot, policy, deltas) → ProjectionResult`**
Mesma lógica aplicada sobre um snapshot hipotético modificado pelos `deltas` (depósitos/saques simulados). Usado no Simulador em tempo real via `useMemo`.

**`computeAlerts(snapshot, policy) → TreasuryAlert[]`**
Gera alertas in-app de 4 tipos:
- `runway` — runway líquido abaixo da meta mínima
- `concentration` — % em único protocolo acima do limite
- `policy` — outras violações de regra
- `obligation` — obrigação com vencimento em ≤ 7 dias

**`validateAction(intent, snapshot, policy) → ValidationResult`**
Valida um intent de depósito/saque contra a política antes de executar.

### Presets de política

| Preset | Runway mín. | Concentração máx. | Liquidez mín. |
|---|---|---|---|
| Conservative | 180d | 30% | 70% |
| Balanced | 90d | 45% | 50% |
| Aggressive | 60d | 60% | 30% |

---

## 6. Funcionalidades — 9 Módulos

### 6.1 Auth
Magic link via Supabase Auth → `/auth/callback` troca code por session cookie → middleware Next.js protege todas as rotas `(app)`.

### 6.2 Onboarding Wizard (4 steps)
1. **Org** — nome + perfil (startup/DAO/fund) + burn mensal
2. **Wallet** — conectar Phantom → SIWS (Sign In With Solana): nonce → sign → verificar ed25519 server-side (tweetnacl) → upsert wallet
3. **Política** — escolher preset (conservative/balanced/aggressive) → cria política v1
4. **Buckets** — definir targets de alocação por categoria → seed automático

### 6.3 Dashboard
Server Component com dados frescos a cada request (`force-dynamic`):
- **KpiGrid** — 4 métricas: total, líquido + runway, deployed + APR, compliance
- **AlertsBanner** — até 4 tipos de alerta computados server-side
- **BucketCard** — barra de progresso por categoria (operating/payroll/tax…)
- **PositionsTable** — posições alocadas com protocolo, APR, risco
- **SnapshotButton** — dispara `takeSnapshot()` Server Action → Helius RPC → insere snapshot → `revalidatePath`

### 6.4 Policy Builder
- Seletor de preset (3 cards)
- Toggles por regra + sliders de parâmetros (MIN_RUNWAY_DAYS, MAX_CONCENTRATION_PCT, MIN_LIQUID_PCT, REBALANCE_TRIGGER) e checkboxes (ALLOCATION_WHITELIST)
- **Geração por IA:** textarea em linguagem natural → `policyFromDescription()` Server Action → Claude Sonnet → JSON de regras → aplica no estado local → salvar

### 6.5 Copilot (AI Chat)
- Chat streaming: `fetch /api/copilot` → `response.body.getReader()` → acumula chunks → renderiza em tempo real
- AbortController para botão de parar stream
- ⌘+Enter para enviar
- Context injetado: snapshot atual + política + projeção de runway
- **5 tools Anthropic:** `analyze_treasury`, `explain_policy`, `propose_allocation`, `simulate_action`, `draft_policy_from_description`
- Prompt caching no system prompt (reduz latência e custo ~80% em turns seguintes)

### 6.6 Simulador
- Sliders de depósito/saque por adapter (Kamino USDC, Mock RWA)
- Recompute em tempo real via `useMemo` + `projectScenario` — zero round-trip ao servidor
- Delta display: +/- colorido para runway, deployed%, APR estimado
- Botão "Salvar recomendação" → Server Action → insert em `recommendations`

### 6.7 Execução
State machine de intents:
```
DRAFT → PROPOSED → APPROVED → QUEUED → SIGNING → BROADCAST → CONFIRMED
                                                              → REJECTED / FAILED
```
- Modo **simulado**: gera signature `SIM-<timestamp>` sem tocar na chain
- Modo **real**: `buildTx()` → `signAndSend()` via Phantom → `confirmTx()` polling

### 6.8 Relatórios
- **Decision Log:** timeline mesclada de `audit_log` + `events` ordenada por data
- **Resumo Executivo:** Server Action chama Claude Sonnet 4.6 com dados do snapshot → texto PT-BR ≤150 palavras para o founder
- **PDF Export:** jsPDF (dynamic import) → A4 com header, KPIs em grid 2 colunas, tabela de posições, violações, resumo executivo, footer

### 6.9 Cron (Supabase Edge Function)
`supabase/functions/snapshot-cron/index.ts` — runtime Deno:
- Chamada a cada 5 min via `pg_cron` no Supabase Postgres
- Busca todas as wallets primárias cadastradas
- Helius RPC: `getBalance` (SOL) + `getTokenAccountsByOwner` (USDC)
- Insere snapshot por org automaticamente

---

## 7. Fluxo Completo do Sistema

```
1. Login
   └── magic link → email → /auth/callback → session

2. Onboarding (primeira vez)
   └── org → Phantom SIWS → política preset → targets de bucket

3. Dashboard
   └── Snapshot manual (ou automático via cron/webhook)
       └── AlertsBanner mostra violações e obrigações urgentes

4. Policy Builder
   └── Ajustar regras manualmente ou descrever em português → IA gera JSON

5. Copilot
   └── Analisar tesouraria → IA retorna diagnóstico com base no snapshot

6. Simulador
   └── Arrastar sliders → ver projeção em tempo real → Salvar recomendação

7. Execução
   └── Recomendação → Aprovar intent → Assinar com Phantom → Confirmar on-chain

8. Relatórios
   └── Gerar resumo executivo (IA) → Exportar PDF auditável
```

---

## 8. Integração Solana

### SIWS (Sign In With Solana)
```
Cliente:  conectar Phantom → solicitar nonce → assinar mensagem
Servidor: verificar assinatura ed25519 (tweetnacl) → upsert wallet no DB
```

### Helius RPC
- `getBalance` — saldo SOL em lamports
- `getTokenAccountsByOwner` — saldo USDC devnet (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- Fallback para `https://api.devnet.solana.com` se env não definida

### Helius Webhook
- Tipo: enhanced · Rede: devnet
- Autenticação: `Authorization: Bearer <HELIUS_WEBHOOK_SECRET>`
- Trigger: qualquer transação nos endereços cadastrados
- Ação: registra evento em `events` + dispara novo snapshot para a org

### Kamino Lending SDK
- Adapter: `KaminoUsdcAdapter` em `src/lib/adapters/kamino.ts`
- Métodos: `deposit(amountUsd)`, `withdraw(amountUsd)`, `getPosition()`
- Market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF` (devnet)
- Externalizado do bundle Turbopack via `serverExternalPackages`

### Mock RWA Adapter
- Simula ativo tipo Ondo USDY — APR fixo 4.82%
- Redeem delay de 1 dia (simula período de lock)
- Persiste posições em `mock_positions` no DB

---

## 9. IA — Anthropic Claude

### Copilot (`streamCopilotTurn`)
- Model: `claude-sonnet-4-6`
- System prompt: contexto da org (snapshot + política + projeção) com **prompt caching** (`cache_control: ephemeral`) — reduz custo ~80% após primeiro turn
- Streaming: async generator → `ReadableStream` no route handler → `getReader()` no cliente
- 5 tools com guardrails: validações de whitelist, runway mínimo antes de propor alocação

### Executive Summary (`generateExecutiveSummary`)
- Server Action separada, sem streaming
- Prompt estruturado com todos os KPIs da tesouraria
- Resposta em PT-BR ≤150 palavras, tom direto para o founder

### Policy from Description (`policyFromDescription`)
- Prompt que mapeia linguagem natural → JSON de `PolicyRule[]`
- Retorna preset sugerido + array de 7 regras com parâmetros

---

## 10. Deploy e Infraestrutura

```
Vercel
├── Região: gru1 (São Paulo)
├── Build: next build (Turbopack)
├── Env vars: via dashboard (não hardcodadas)
└── URL: https://treasury-os-black.vercel.app

Supabase
├── Projeto: joeyutliqcqcefeidsdf
├── RLS: ativo em todas as tabelas
├── Auth: magic link habilitado
│         Redirect URL: https://treasury-os-black.vercel.app/auth/callback
└── Edge Function: snapshot-cron (Deno)
    └── pg_cron: SELECT cron.schedule('*/5 * * * *', ...)

GitHub
└── https://github.com/Nogcrypto/treasury_os
    └── branch: master → auto-deploy Vercel
```

---

## 11. Estrutura de Arquivos

```
src/
├── app/
│   ├── (app)/          — rotas autenticadas
│   │   ├── dashboard/  — page.tsx + actions.ts
│   │   ├── policy/     — page.tsx + actions.ts
│   │   ├── copilot/    — page.tsx
│   │   ├── simulator/  — page.tsx + actions.ts
│   │   ├── execution/  — page.tsx + actions.ts + ExecutionClient.tsx
│   │   └── reports/    — page.tsx + actions.ts + ReportsClient.tsx
│   ├── (auth)/login/   — page.tsx + actions.ts
│   ├── (onboarding)/setup/ — page.tsx + actions.ts
│   └── api/
│       ├── copilot/    — route.ts (streaming)
│       ├── trpc/[trpc] — route.ts
│       └── webhooks/helius/ — route.ts
├── components/
│   ├── AppShell.tsx        — sidebar nav
│   ├── AlertsBanner.tsx    — 4 tipos de alerta
│   ├── Copilot.tsx         — chat streaming UI
│   ├── ExecutionDrawer.tsx — state machine UI
│   ├── PdfExportButton.tsx — jsPDF export
│   ├── PolicyBuilder.tsx   — editor de regras + IA
│   ├── Simulator.tsx       — sliders + projeção real-time
│   ├── dashboard/          — KpiGrid, BucketCard, PositionsTable, SnapshotButton
│   └── onboarding/         — SetupWizard (4 steps + SolanaProvider)
├── lib/
│   ├── adapters/       — interface + kamino.ts + mock-rwa.ts
│   ├── agent/          — client.ts + tools.ts + prompts.ts
│   ├── db/             — schema.ts (12 tabelas) + client.ts
│   ├── rules-engine/   — types + policy + projections + alerts + validation
│   ├── solana/         — wallet.tsx + siws.ts + indexer.ts + tx.ts
│   └── supabase/       — client.ts + server.ts
└── server/
    ├── trpc.ts          — contexto + procedures (public/protected/org)
    └── routers/         — org, snapshot, bucket, obligation, policy,
                           intent, recommendation
supabase/
└── functions/snapshot-cron/index.ts  — Deno edge function
drizzle/
├── migrations/0000_initial.sql
└── seed.sql
docs/
├── PLAN.md
├── Backlog.md
└── TECHNICAL.md  ← este arquivo
```
