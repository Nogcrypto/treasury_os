# TreasuryOS — Backlog

Referência: `PLAN.md`. Ordem segue Section 12 do plano.

## Semana 1 — Foundation

### S1-D1 · Setup ✓
- [x] Mover protótipo HTML para `prototype/`
- [x] `create-next-app` TypeScript + Tailwind v4 + App Router (Next.js 16)
- [x] Instalar deps: drizzle-orm, supabase-js, trpc v11, solana wallet-adapter, @kamino-finance/klend-sdk, @anthropic-ai/sdk, superjson, zustand, zod v4, jspdf, tweetnacl, postgres
- [x] `src/lib/db/schema.ts` — 12 tabelas Drizzle + enums + relations
- [x] `drizzle.config.ts` + `.env.local.example`

### S1-D2 · Rules Engine ✓
- [x] `src/lib/rules-engine/types.ts` — Policy, Rule, Snapshot, ProjectionResult
- [x] `src/lib/rules-engine/policy.ts` — Zod schemas + 3 presets (conservative/balanced/aggressive)
- [x] `src/lib/rules-engine/projections.ts` — `projectRunway()` pura + `projectScenario()`
- [x] `src/lib/rules-engine/validation.ts` — `validateAction()` + `validateActions()` + `formatViolationsForAgent()`
- [ ] `src/lib/rules-engine/__tests__/` — coverage 100% *(pendente)*

### S1-D3 · Auth + Wallet ✓
- [x] `src/lib/supabase/client.ts` — createBrowserClient
- [x] `src/lib/supabase/server.ts` — createServerClient + createAdminClient
- [x] `middleware.ts` — session refresh + redirect guards
- [x] `src/app/(auth)/login/page.tsx` + `actions.ts` — magic link (Server Action)
- [x] `src/app/auth/callback/route.ts` — troca code por sessão
- [x] `src/lib/solana/wallet.tsx` — SolanaProvider + SolanaContextProvider + useSolana()
- [x] `src/lib/solana/siws.ts` — verificação ed25519 server-side + upsert wallet
- [x] `src/server/context.ts` + `src/server/trpc.ts` — tRPC context com auth + orgProcedure

### S1-D4 · DB + tRPC scaffold ✓ (parcial)
- [x] `drizzle/migrations/0000_initial.sql` — schema completo + RLS + trigger auth.users + comentário pg_cron
- [x] `drizzle/seed.sql` — Capivara Labs com política, buckets, obrigações e snapshot inicial
- [x] `src/server/routers/intent.ts` — state machine DRAFT→CONFIRMED + modo simulado
- [x] `src/server/routers/index.ts` + `src/app/api/trpc/[trpc]/route.ts` — tRPC handler
- [x] tRPC routers: org, snapshot, bucket, obligation ✓
- [x] Supabase: rodar migração no projeto real + seed

### S1-D5 · Indexer + Webhook ✓
- [x] `src/lib/solana/indexer.ts` — `fetchWalletBalances()` + `registerHeliusWebhook()`
- [x] `src/app/api/webhooks/helius/route.ts` — intake de eventos onchain

### S1-D6 · Adapters ✓
- [x] `src/lib/adapters/interface.ts` — AllocationAdapter interface
- [x] `src/lib/adapters/kamino.ts` — KaminoUsdcAdapter (devnet real, SDK oficial)
- [x] `src/lib/adapters/mock-rwa.ts` — MockRwaAdapter (APR 4.82%, delay 1d redeem)

### S1-D7 · Agent ✓
- [x] `src/lib/agent/tools.ts` — 5 tools Anthropic (analyze, explain, propose, simulate, draft_policy)
- [x] `src/lib/agent/client.ts` — `runCopilotTurn()` + `streamCopilotTurn()` com guardrails + reprompt automático
- [x] `src/lib/agent/prompts.ts` — system prompt PT-BR com prompt caching

### S1-D8 · Dashboard inicial ✓
- [x] `src/app/(app)/dashboard/page.tsx` — server component com KPIs + buckets + violações + obrigações
- [x] `src/app/(app)/layout.tsx` — auth guard + tema
- [x] `src/app/layout.tsx` — Inter + JetBrains Mono + globals.css (design tokens oklch)
- [x] `src/components/dashboard/KpiGrid.tsx` — 4-up KPI grid com compliance score
- [x] `src/components/dashboard/BucketCard.tsx` — bucket card com fill bar
- [x] `src/components/dashboard/PositionsTable.tsx` — Kamino + RWA positions table
- [x] `src/components/dashboard/SnapshotButton.tsx` — client component com loading state
- [x] `src/app/(app)/dashboard/actions.ts` — Server Action `takeSnapshot()`

---

## Semana 2 — Core

### S2-D9 · tRPC routers completos ✓ (parcial)
- [x] `server/routers/org.ts` — create org + seed buckets automático
- [x] `server/routers/snapshot.ts` — trigger manual + leitura + projection
- [x] `server/routers/bucket.ts` — CRUD buckets
- [x] `server/routers/obligation.ts` — CRUD obrigações
- [x] `server/routers/policy.ts` — list, active, create, activate, archive, setPreset ✓

### S2-D10 · Onboarding Wizard ✓
- [x] `src/app/(onboarding)/setup/page.tsx` — 4 steps (org → wallet → policy → buckets)
- [x] SIWS integrado no step de wallet (client component, useSolana)
- [x] Seed automático de buckets + política ao criar org
- [x] `src/components/onboarding/SetupWizard.tsx` — wizard client com SolanaProvider
- [x] `src/app/(onboarding)/setup/actions.ts` — createOrg, linkWallet, setOrgPreset, updateBucketTargets

### S2-D11 · Policy Builder UI ✓
- [x] `src/components/PolicyBuilder.tsx` — preset cards + toggles por regra + editors de params
- [x] `src/app/(app)/policy/page.tsx` + `actions.ts` — server component + saveAndActivate
- [x] Histórico de versões na página

### S2-D12 · Copilot UI ✓
- [x] `src/components/Copilot.tsx` — chat streaming client, abort, sugestões
- [x] `src/app/api/copilot/route.ts` — ReadableStream via streamCopilotTurn
- [x] `src/app/(app)/copilot/page.tsx`

### S2-D13 · Simulador UI ✓
- [x] `src/components/Simulator.tsx` — sliders, projectScenario client-side, delta display
- [x] `server/routers/recommendation.ts` — save, approve (cria intents), dismiss
- [x] `src/app/(app)/simulator/page.tsx` + `actions.ts` — saveRecommendation
- [x] `src/components/AppShell.tsx` — sidebar nav com activeLink

### S2-D14 · Execução UI ✓
- [x] `src/components/ExecutionDrawer.tsx` — status badges, pulsing dot, ações por status
- [x] `src/app/(app)/execution/page.tsx` + `actions.ts` + `ExecutionClient.tsx`
- [x] `src/lib/solana/tx.ts` — buildTx + signAndSend + confirmTx (simulado e real)

### S2-D15 · Supabase Edge Functions ✓ (parcial)
- [x] `supabase/functions/snapshot-cron/index.ts` — pg_cron 5 min (Helius RPC, insert snapshot)
- [ ] Deploy + configurar pg_cron no projeto Supabase real

---

## Semana 3 — Polish + Stretch + Demo

- [x] Decision log + executive summary (`src/app/(app)/reports/page.tsx` + `ReportsClient.tsx` + `actions.ts`)
- [x] Export PDF (jsPDF) — `src/components/PdfExportButton.tsx`
- [x] Alertas in-app (4 tipos) — `src/components/AlertsBanner.tsx` + `src/lib/rules-engine/alerts.ts`
- [x] Stretch: `draft_policy_from_description` — `policyFromDescription()` em `policy/actions.ts` + textarea em `PolicyBuilder.tsx`
- [x] Deploy Vercel prod + variáveis de ambiente — `vercel.json` com região gru1 + env refs
- [ ] Smoke tests devnet com wallet real
- [ ] Gravar demo (5 min) + submissão Superteam Earn + pitch deck

---,

## Integrações (side tracks)

| Integração | Status |
|---|---|
| Phantom Wallet Adapter + SIWS | ✅ implementado (falta integrar no onboarding UI) |
| Helius Webhooks + RPC Fast | ✅ webhook handler + indexer implementados |
| Anthropic Claude Opus 4.7 + Sonnet 4.6 + prompt caching | ✅ client + 5 tools implementados |
| Kamino SDK devnet | ✅ adapter implementado |
| Mock RWA (Ondo-like) | ✅ adapter implementado |
| Supabase auth/db/cron/edge | ✅ schema + RLS + auth — falta rodar em projeto real |
