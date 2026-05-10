# TreasuryOS — Arquitetura, Módulos, Fluxos e Requisitos (Hackathon, solo, 2-3 semanas)

## Contexto

TreasuryOS é um **CFO operacional onchain** para startups web3 e DAOs que mantêm caixa em stablecoins na Solana. O problema é que essas organizações seguram caixa sem política de tesouraria, sem separação de reservas e sem alocação intencional. A proposta é transformar **tesouraria em política executável**: o usuário conecta wallet, declara compromissos e runway, e o sistema classifica caixa em buckets (operação, reserva, impostos, excedente), recomenda política via AI e executa (ou simula) alocações conservadoras — inclusive RWA.

Projeto concorre no **Solana Frontier Hackathon** na trilha principal **AI + crypto / Developer tooling**, com ataque explícito às side tracks: **Superteam Brasil**, **Superteam Korea (build station)**, **Phantom Connect**, **RPC Fast / Helius (infra)** e **AI+crypto**.

**Restrições do build**: solo, 2-3 semanas. Plano é dimensionado para caber com folga e deixar tempo para pitch, submissão e polish — cortes explícitos de escopo estão marcados.

**Decisões confirmadas com o usuário:**
- Execução **devnet real com toggle de simulado** (Phantom assina em devnet; toggle "simulated mode" para demo safe).
- Adapters: **Kamino real (USDC lending) + 1 RWA mock realista** (imitando Ondo USDY sem KYC).
- Backend: **Supabase** (auth + Postgres + Edge Functions + pg_cron).

---

## 1. Arquitetura Macro

### 1.1 Diagrama

```
┌────────────────────────────────────────────────────────┐
│ Next.js 14 App (Vercel)                                │
│  - App Router + RSC                                    │
│  - shadcn/ui + Tailwind + Recharts                     │
│  - @solana/wallet-adapter (Phantom primary)            │
│  - TanStack Query + Zustand (UI state)                 │
└────────────────────────────────────────────────────────┘
                    │ tRPC (end-to-end types)
┌────────────────────────────────────────────────────────┐
│ Next.js Route Handlers (serverless on Vercel)          │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐            │
│  │ Agent    │ │ Rules      │ │ Execution  │            │
│  │ (Claude) │ │ Engine     │ │ Orchestr.  │            │
│  └──────────┘ └────────────┘ └────────────┘            │
└────────────────────────────────────────────────────────┘
           │                │                │
┌──────────────────┐ ┌──────────────────────────────────┐
│ Supabase         │ │ Solana Devnet                    │
│ - Auth (magic)   │ │ - Phantom assina do device       │
│ - Postgres (RLS) │ │ - Kamino devnet (lending)        │
│ - Edge Functions │ │ - Mock RWA program (simples)     │
│ - pg_cron        │ │                                  │
│ - Webhook intake │ │ Helius devnet webhooks + RPC Fast│
└──────────────────┘ └──────────────────────────────────┘
```

### 1.2 Princípios de design

- **AI interpreta; regras determinísticas decidem crítico.** Agente propõe e explica; `rules-engine` puro valida antes de virar intent.
- **Event-sourced state.** Policy change, snapshot, approval, execution → todos viram eventos imutáveis. Estado atual é projeção.
- **Adapter pattern.** `AllocationAdapter` com interface única. MVP: 2 adapters (Kamino + RWA mock).
- **Idempotência em execução.** Cada intent tem `idempotency_key`; lock otimista em approval.
- **Tudo serverless.** Supabase + Vercel = zero ops.

### 1.3 Stack definitivo

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Recharts, TanStack Query, Zustand, Zod |
| Wallet | @solana/wallet-adapter-react + **Phantom** (único no MVP — pega side track) |
| Auth | Supabase Auth (magic link) + SIWS para vincular wallet à org |
| API | tRPC sobre Next.js route handlers |
| DB | Supabase Postgres + Drizzle ORM + RLS |
| Agent | Anthropic SDK — **Claude Opus 4.7** (policy generation, explanation); **Sonnet 4.6** (classificação rápida). Prompt caching obrigatório. |
| Rules engine | TypeScript puro, unit-testável, zero deps externas |
| Indexing | **Helius Webhooks** (balance changes, program events) + **RPC Fast** como fallback |
| Solana | @solana/web3.js v2 |
| Kamino | @kamino-finance SDK oficial |
| RWA mock | Módulo TS que simula Ondo USDY (APR, posições, redeem com delay) |
| Jobs | Supabase pg_cron para snapshots periódicos |
| Observability | Sentry + Supabase logs |

**Cortado do escopo** (vs versão inicial): monorepo Turborepo, Anchor program próprio, Backpack/Solflare, Resend/email, Squads, Inngest/QStash, Jupiter (move para stretch).

---

## 2. Modelo de Domínio e Controle de Estado

### 2.1 Tabelas (Drizzle + Supabase)

```
organizations(id, name, profile, base_currency, simulated_mode, created_at)
users(id, email, created_at)
memberships(org_id, user_id, role)
wallets(id, org_id, address, label, is_primary)
policies(id, org_id, version, status, json_spec, created_by, activated_at)
buckets(id, org_id, kind, target_amount_cents, target_pct, currency)
  -- kind: operating | payroll | tax | emergency | yield | custom
obligations(id, org_id, label, amount_cents, due_date, recurrence, bucket_id)
snapshots(id, org_id, taken_at, totals_json, positions_json)
recommendations(id, org_id, policy_version, created_at, rationale, actions_json, status)
intents(id, org_id, recommendation_id, kind, params_json, status, idempotency_key, created_at)
executions(id, intent_id, tx_signature, status, onchain_at, error)
events(id, org_id, type, payload_json, created_at)  -- event log canônico
audit_log(id, org_id, actor, action, target, diff_json, at)
```

RLS policies limitando por `org_id` via `memberships`.

### 2.2 Máquina de estado de Intent

```
DRAFT → PROPOSED → APPROVED → QUEUED → SIGNING → BROADCAST → CONFIRMED
                           ↘ REJECTED                       ↘ FAILED
                                                            ↘ EXPIRED
```

No modo simulado, o fluxo pula `SIGNING/BROADCAST` e vai direto para `CONFIRMED` com `tx_signature = 'SIM-<uuid>'`.

### 2.3 Concorrência — pontos críticos

| Problema | Solução |
|---|---|
| Dois tabs aprovando mesmo intent | `version` na linha + update condicional `WHERE version = ?` |
| Webhook Helius antes da confirmação local | Dedup por `tx_signature` em `executions` e `events` |
| Retry de usuário duplica tx | `idempotency_key = hash(intent_id + wallet + recentBlockhash)` |
| Policy editada durante geração de recomendação | Recomendação grava `policy_version`; se mudou, invalida e regera |
| Snapshot concorrente com execução | Snapshots são imutáveis; execução só lê estado atual |

### 2.4 Snapshots e projeção

- Cron a cada **5 min** (devnet) via pg_cron → Edge Function que chama Helius, agrega saldos, lê posições dos adapters, persiste snapshot.
- `projectRunway(snapshot, obligations, policy)` → `{ runway_days, liquid_runway, protected_runway, concentration, compliance_score }`. Função pura, 100% testável.
- **Scenarios**: mesma função com diff aplicado (ex. +250k Kamino USDC, -250k caixa livre) sem persistir.

---

## 3. Módulos Funcionais (MVP enxuto)

### 3.1 Onboarding
- Signup magic link (Supabase Auth).
- Criar org + perfil (Startup / DAO / Fund).
- **Phantom Connect + SIWS** para vincular wallet à org.
- Wizard curto: burn mensal, folha (dia/valor), impostos (%), próximos eventos (3 fields).
- Seed automático de buckets (operating, payroll, tax, emergency, yield).

### 3.2 Treasury Dashboard (cockpit)
**KPIs no topo (8)**: Total treasury, Liquid runway, Protected runway, Upcoming obligations (30d), Deployed capital, Estimated yield (APR médio), Concentration risk (top asset %), Policy compliance score.

**Abaixo**:
- Bucket view (5 buckets) com fill bars vs meta.
- Posições por protocolo (Kamino + RWA mock).
- Timeline de obrigações 30/60/90d.
- Concentration breakdown (donut).

### 3.3 Policy Engine (núcleo)
- **3 presets**: Conservative / Balanced / Aggressive.
- **Regras primitivas** (7):
  - `MIN_RUNWAY_DAYS`
  - `MAX_CONCENTRATION_PCT` (por ativo e por protocolo)
  - `MIN_LIQUID_PCT`
  - `BUCKET_TARGET` (valor ou %)
  - `ALLOCATION_WHITELIST`
  - `YIELD_ONLY_EXCESS`
  - `REBALANCE_TRIGGER` (% de desvio)
- Versionamento (nova edição = nova `policy.version`).
- **Policy Builder UI**: formulário visual com cards de regra.
- **Modo texto→AI**: campo "descreva em texto" → agente gera JSON via tool use → `rules-engine.validate()` antes de salvar. Se inválido, reprompt automático com motivo. *(stretch — implementar depois que visual estiver pronto)*

### 3.4 AI Copilot
Agente Claude com **5 tools**:
- `draft_policy_from_description(text)` — Opus 4.7.
- `explain_policy(policy_id)` — Sonnet 4.6.
- `analyze_treasury()` — Sonnet 4.6; identifica gaps, riscos, excedente ocioso.
- `propose_allocation(excess_amount)` — Opus 4.7; gera lista de ações com rationale.
- `simulate_scenario(actions[])` — Sonnet 4.6; narra diff de runway/yield/concentration.

**Prompt caching**: bloco cacheado com policy JSON + últimos 3 snapshots (muda devagar). Reduz latência e custo drasticamente.

**Guardrails**: saída que propõe ação roda por `rules-engine.validateAction(policy, action)` antes de virar intent. Violação → agente é reprompted com o motivo, max 2 retries.

### 3.5 Allocation Layer
Interface:

```ts
interface AllocationAdapter {
  id: string;
  kind: 'lending' | 'rwa';
  riskTier: 1 | 2 | 3;
  quote(amountUsd: number): Promise<{ apr: number; fees: number; unlockDays: number }>;
  buildDepositTx(wallet: PublicKey, amount: number): Promise<Transaction>;
  buildWithdrawTx(wallet: PublicKey, amount: number): Promise<Transaction>;
  readPosition(wallet: PublicKey): Promise<{ amount: number; accruedYield: number }>;
}
```

MVP:
- `kamino-usdc-devnet` — SDK oficial, lending USDC (riskTier 1). Teste com wallet devnet + airdrop USDC devnet.
- `mock-rwa-usdy` — módulo TS que simula Ondo USDY (riskTier 2). APR fixo 4.8%, delay de 1 dia no redeem, posições persistidas em tabela `mock_positions`. No modo simulado nem emite tx.

### 3.6 Buckets de Pagamento e Reserva
- CRUD buckets com metas (valor fixo ou % do total).
- `fill_rate = balance / target`.
- Alertas quando abaixo do alvo ou acima do exagero.
- Obrigação anexada a bucket (folha → payroll).
- Excedente = `total − Σ(buckets protegidos) − runway_mínimo`.

### 3.7 Simulador de Cenários
- UI: sliders por adapter + input livre de ação.
- Recomputa `projectRunway` em tempo real com diff aplicado.
- Comparador 3-wide: baseline vs cenário A vs cenário B.
- Card "Antes/Depois" highlight para demo.

### 3.8 Execução
- **Modo devnet real**: adapter → tx → `signAndSendTransaction` via wallet-adapter → aguarda confirmation → evento + snapshot.
- **Modo simulado** (toggle por org): intent vira evento sem onchain; `tx_signature = 'SIM-<uuid>'`. Usado no pitch.
- Retry com backoff exponencial, max 3 tentativas; expira após 10 min.

### 3.9 Reporting
- **Decision log**: linha do tempo de policies, recommendations, approvals, executions com rationale.
- **Executive summary** gerado pelo Copilot sob demanda ("resuma últimos 7 dias").
- Export PDF (jsPDF) para demo.

### 3.10 Alertas (in-app apenas)
- Runway abaixo da meta.
- Concentração excedida.
- Obrigação < 7 dias sem reserva.
- Desvio de policy > threshold.

**Cortado do MVP**: email (Resend), webhook de saída, multisig/approvals multi-user.

---

## 4. Fluxos Principais

### 4.1 Primeira sessão (golden path da demo)
1. Signup + criar org.
2. Phantom Connect + SIWS.
3. Wizard (burn, folha, impostos).
4. Snapshot inicial → dashboard renderiza.
5. Copilot auto-executa `analyze_treasury()` → cria recomendação de policy.
6. Usuário ativa policy preset sugerido.
7. Copilot propõe alocação do excedente.
8. Simulador mostra antes/depois.
9. Usuário aprova → assina no Phantom (devnet) → confirma.
10. Reporting mostra resumo.

### 4.2 Ciclo de rebalance (background)
1. pg_cron roda snapshot a cada 5 min.
2. Rules engine compara snapshot vs policy.
3. Se violação → cria `recommendation` + alerta in-app.
4. Usuário abre → simula → aprova → executa.

### 4.3 Policy via texto (stretch)
1. Usuário digita "quero 4 meses protegidos, só aplicar excedente, sem mais de 30% em um protocolo".
2. Agente chama `draft_policy_from_description` com tool use → retorna JSON.
3. `rules-engine.validate(json)` → se falhar, agente reprompted com erros.
4. Preview mostra diff vs policy atual → usuário ativa.

---

## 5. Requisitos Funcionais — checklist por módulo

**Onboarding** — magic link, criar org, Phantom+SIWS, wizard 3-fields, seed buckets.

**Dashboard** — 8 KPIs, 5 bucket cards, posições por protocolo, timeline obrigações, donut concentração.

**Policy Engine** — 3 presets, 7 tipos de regra, versionamento, Zod validation, builder visual, texto→AI (stretch).

**Copilot** — 5 tools, prompt caching, guardrails com reprompt, rationale em PT.

**Allocation** — interface `AllocationAdapter`, `kamino-usdc-devnet` real, `mock-rwa-usdy`, quote/deposit/withdraw/readPosition.

**Buckets** — CRUD, metas fixas/%, fill rate, obrigação→bucket, excedente calc.

**Simulador** — sliders, recompute tempo real, comparador 3-wide, card antes/depois.

**Execução** — state machine, idempotency_key, modo simulado toggle, retry+expire.

**Reporting** — decision log, executive summary, export PDF.

**Alertas** — in-app com 4 tipos.

---

## 6. Integrações (cobertura de trilhas)

| Integração | Side track | Criticidade |
|---|---|---|
| **Phantom Wallet Adapter + SIWS** | **Phantom Connect** | Must |
| **Helius Webhooks + RPC Fast** | **RPC Fast / Infra** | Must |
| **Anthropic Claude (Opus 4.7 + Sonnet 4.6) com prompt caching** | **AI + crypto** | Must |
| **Kamino SDK (devnet)** | DeFi / infra | Must |
| **Mock RWA (Ondo-like)** | RWA narrative | Must |
| **Supabase** (auth/db/cron/edge) | — | Must |
| **Pyth price feeds** | infra | Should |
| **Submissão Superteam Earn + Build Station Korea** | **Superteam BR + KR** | Must (ação não-técnica) |
| Jupiter swap | DeFi | Stretch |
| Squads multisig | Enterprise | Roadmap |

---

## 7. Segurança

- **Não custodiamos chaves.** Sempre wallet-adapter; assinatura no device do usuário.
- **Devnet only** no MVP. Flag `mainnet_enabled` desligada.
- **Rate limit** no agente (10 calls/min por org).
- **Audit log append-only**.
- **Server-side validation** antes de qualquer intent virar tx.
- **RLS no Supabase** em todas as tabelas.
- **PII mínima** (só email).

---

## 8. Estrutura de repositório (single Next.js app, sem monorepo)

```
treasury_os/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (marketing)/page.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── policy/page.tsx
│   │   │   ├── simulate/page.tsx
│   │   │   └── reports/page.tsx
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/route.ts
│   │   │   └── webhooks/helius/route.ts
│   │   └── layout.tsx
│   ├── server/
│   │   ├── routers/                 # tRPC routers
│   │   │   ├── org.ts
│   │   │   ├── policy.ts
│   │   │   ├── snapshot.ts
│   │   │   ├── recommendation.ts
│   │   │   └── intent.ts
│   │   └── context.ts
│   ├── lib/
│   │   ├── rules-engine/            # TS puro
│   │   │   ├── policy.ts
│   │   │   ├── projections.ts
│   │   │   └── validation.ts
│   │   ├── agent/
│   │   │   ├── tools.ts
│   │   │   ├── prompts.ts
│   │   │   └── client.ts
│   │   ├── adapters/
│   │   │   ├── interface.ts
│   │   │   ├── kamino.ts
│   │   │   └── mock-rwa.ts
│   │   ├── solana/
│   │   │   ├── wallet.tsx
│   │   │   ├── indexer.ts
│   │   │   └── tx.ts
│   │   └── db/
│   │       ├── schema.ts
│   │       └── client.ts
│   └── components/
│       ├── ui/                      # shadcn
│       ├── Dashboard/
│       ├── PolicyBuilder.tsx
│       ├── Simulator.tsx
│       ├── Copilot.tsx
│       └── BucketCard.tsx
├── drizzle/                         # migrations
├── supabase/                        # local config + edge functions
│   └── functions/
│       └── snapshot-cron/
├── public/
└── docs/
    └── pitch.md
```

---

## 9. Cronograma realista (solo, 3 semanas)

**Semana 1 — Foundation**
- D1-2: Setup (Next.js, Supabase, Drizzle, wallet-adapter, shadcn).
- D3: Schema + RLS + tRPC scaffolding.
- D4: Rules engine (policy + projections + validation) com testes.
- D5: Phantom connect + SIWS + onboarding wizard.
- D6-7: Dashboard com KPIs mocados + buckets + snapshot manual.

**Semana 2 — Core**
- D8: Helius webhook + snapshot real + pg_cron.
- D9: Policy Builder UI + presets + versionamento.
- D10: Copilot com 3 tools (analyze, explain, propose).
- D11: Kamino adapter devnet + teste manual.
- D12: Mock RWA adapter.
- D13: Simulador com sliders + comparador.
- D14: Execution state machine + modo simulado toggle.

**Semana 3 — Polish + Stretch + Demo**
- D15: Decision log + executive summary + PDF export.
- D16: Alertas in-app + 4 tipos.
- D17: **Stretch** — texto→AI com tool use + guardrails.
- D18: Polish visual, seed data realista, copy do pitch.
- D19: Deploy final (Vercel prod) + smoke tests devnet.
- D20: Gravar vídeo demo + submissão Superteam Earn + pitch deck.
- D21: Buffer.

---

## 10. Demo Script (5 min)

1. **0:00** Founder conecta Phantom, cria org.
2. **0:45** Wizard: "gasto 120k/mês, folha dia 5, imposto trimestral". Dashboard: 800k caixa, runway 6.6 meses, 100% parado.
3. **1:30** Copilot: "você tem 320k ociosos acima do runway mínimo". Sugere policy Conservative.
4. **2:15** Usuário edita via "descreva em texto": "4 meses protegidos, tax bucket separado". Agente gera JSON, valida.
5. **3:00** Simulador: aloca 250k Kamino USDC + 70k mock RWA. Antes/Depois: runway protegido ↑, yield +4.8%.
6. **3:45** Aprova, assina com Phantom (devnet), tx confirma.
7. **4:15** Reporting: executive summary em 1 parágrafo.
8. **4:45** Pitch frase: *"TreasuryOS is an AI treasury copilot for startups and DAOs on Solana. It turns idle stablecoin balances into policy-driven treasury management."*

---

## 11. Verificação

- **Unit**: `rules-engine` (policy validation + projections + scenarios) — 100% coverage nesse pacote.
- **Integração**: fluxo completo em devnet com wallet de teste (USDC devnet airdrop via Circle faucet).
- **Smoke test**: rodar snapshot contra wallet real read-only.
- **Pre-demo checklist**: submissão Superteam Earn, build prod Vercel ok, seed data realista, wallet devnet funded, modo simulado default-on para demo.

---

## 12. Arquivos críticos — ordem de implementação

1. `src/lib/db/schema.ts` — Drizzle schema completo.
2. `src/lib/rules-engine/policy.ts` + `projections.ts` — com testes unitários.
3. `src/lib/solana/wallet.tsx` — provider + Phantom + SIWS.
4. `src/app/(app)/dashboard/page.tsx` — cockpit.
5. `src/components/PolicyBuilder.tsx` + presets.
6. `src/lib/adapters/interface.ts` + `kamino.ts` + `mock-rwa.ts`.
7. `src/lib/agent/tools.ts` + `client.ts` (com prompt caching).
8. `src/components/Simulator.tsx`.
9. `src/server/routers/intent.ts` — state machine + execução.
10. `src/lib/solana/indexer.ts` + `src/app/api/webhooks/helius/route.ts`.
11. `src/components/Copilot.tsx`.
12. `supabase/functions/snapshot-cron/` + pg_cron config.

---

## 13. Roadmap pós-hackathon

Multi-wallet real, multisig/Squads, vendor payroll automation, fiat rails, compliance por jurisdição, AI forecasting com histórico, benchmarking anônimo entre tesourarias, mainnet com limites, autonomous execution gated por multisig.
