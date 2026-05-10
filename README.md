<div align="center">
  <img src="public/logo.png" alt="TreasuryOS" width="200" />

  <h1>TreasuryOS</h1>

  <p><strong>The Startup Financial Operating System — Policy-Driven Treasury Management on Solana</strong></p>

  <p>
    <a href="https://treasury-os-black.vercel.app"><strong>🚀 Live Demo</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="docs/TECHNICAL.md">Technical Docs</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="docs/PLAN.md">Project Plan</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white" alt="Solana" />
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Claude-Sonnet_4.6-D97706?logo=anthropic&logoColor=white" alt="Anthropic" />
    <img src="https://img.shields.io/badge/Vercel-gru1_(São_Paulo)-black?logo=vercel" alt="Vercel" />
    <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Kamino-Lending-4F46E5" alt="Kamino" />
  </p>
</div>

---

## The Problem

Seed-to-Series B startups sit on **$1–5M in USDC/SOL with no formal treasury process**. There's no dedicated treasurer, no allocation policy, no compliance trail — founders discover the problem only when runway suddenly ends.

Capital sits idle in hot wallets earning nothing. Investors ask *"how are you managing the war chest?"* and the answer is a spreadsheet, if anything at all.

---

## The Solution

**TreasuryOS** connects directly to your organization's Solana wallet, applies configurable allocation policies, suggests DeFi moves via AI, and executes deposits/withdrawals on-chain — all with an auditable decision log and a one-click PDF report for investors.

```
Wallet Balance → Rules Engine → AI Copilot → DeFi Execution → Audit Trail → PDF Report
```

> Think of it as a **CFO co-pilot that runs 24/7 on-chain**.

---

## Live Demo

### [https://treasury-os-black.vercel.app](https://treasury-os-black.vercel.app)

**Demo account (pre-loaded with $847k mock treasury):**
- Email: `dev@capivara.xyz`
- Password: `Senha@123`

Or register your own account and connect Phantom on devnet to see real on-chain balance data. The Simulator includes a **hypothetical mode** — no real balance required to model allocation scenarios.

---

## Features — 9 Modules

| Module | What It Does |
|---|---|
| **Onboarding Wizard** | 4-step setup: org profile → Phantom SIWS → policy preset → bucket targets. Registers full name, phone, country. |
| **Dashboard** | Live KPIs: total balance, liquid runway (months), deployed APR, compliance score, alert banner. Links to all 5 modules. |
| **Policy Builder** | Configure allocation rules via sliders — or **describe in plain Portuguese**, AI generates the JSON policy |
| **AI Copilot** | Streaming chat with full treasury context. 5 tools with guardrails: analyze, explain, propose, simulate, draft. Full tool-use loop (no mid-response cutoffs). |
| **Simulator** | Real-time projection — drag sliders, see runway and APR impact instantly. **Hypothetical mode** works even with $0 devnet balance. |
| **Execution** | State machine DRAFT→CONFIRMED. Real Phantom signing or simulated mode. Kamino + Mock RWA. |
| **Reports** | AI-generated executive summary + merged audit/event timeline + one-click PDF export |
| **Auto-Snapshots** | Supabase Edge Function (Deno) snapshots all wallets every 5 min via pg_cron + Helius RPC |
| **Webhooks** | Helius enhanced webhook: any on-chain transaction triggers instant snapshot refresh |

---

## Architecture

```
Browser (React Client Components)
  ├── tRPC v11           — mutations with optimistic UI
  ├── Server Actions     — wizard forms, snapshot triggers, policy save
  └── fetch /api/copilot — streaming SSE from Anthropic (tool-use loop)

Next.js 16 Server (App Router + Turbopack)
  ├── Server Components  — reads DB directly via Drizzle (zero round-trip)
  ├── Demo intercept     — email-based bypass at every data layer (no DB queries)
  └── Route Handlers
        ├── /api/trpc/[trpc]       — tRPC adapter
        ├── /api/copilot           — Anthropic streaming handler
        ├── /api/setup             — org creation, wallet linking, policy/bucket config
        └── /api/webhooks/helius   — on-chain event intake

Supabase
  ├── Postgres + Drizzle ORM   (13 tables, RLS enforced by org_id)
  ├── Auth                     email/password + magic link → /auth/callback
  └── Edge Function            snapshot-cron (Deno, pg_cron every 5 min)

Solana devnet
  ├── Helius RPC         — getBalance + getTokenAccountsByOwner
  ├── Helius Webhooks    — enhanced events → /api/webhooks/helius
  ├── Kamino Lending SDK — real USDC deposit/withdraw on devnet
  └── Mock RWA Adapter   — simulates Ondo USDY (4.82% APR, 1-day redeem)
```

**Route groups:**
- `(app)` — all authenticated pages with auth guard via middleware
- `(auth)` — login, register, forgot-password + Supabase callback
- `(onboarding)` — 4-step wizard (first-time users)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** — App Router, Turbopack, Server Components |
| API | **tRPC v11** + Next.js Server Actions |
| Database | **Supabase Postgres** + Drizzle ORM + Row Level Security |
| Auth | **Supabase Auth** (email/password + magic link) + **SIWS** ed25519 (tweetnacl / bs58) |
| Blockchain | **Solana devnet** · @solana/web3.js · `window.phantom.solana` direct API |
| Indexer | **Helius** RPC + Enhanced Webhooks |
| DeFi | **Kamino Lending SDK** (devnet) + Mock RWA adapter |
| AI | **Anthropic Claude Sonnet 4.6** — streaming + tool-use loop + prompt caching |
| Rules Engine | Pure TypeScript · zero I/O · runs on server and client |
| Styling | **Tailwind v4** — oklch design tokens, `@theme inline`, fully responsive |
| PDF Export | **jsPDF** — dynamic import, client-side only |
| Deploy | **Vercel** (region gru1 — São Paulo) + Supabase Edge Functions |
| Patch | **patch-package** — fixes `rpc-websockets/uuid` ESM incompatibility at build time |

---

## Solana Integration

### SIWS — Sign In With Solana
```
Client: connect via window.phantom.solana.connect() → request nonce → sign message
Server: verify ed25519 signature (tweetnacl + bs58) → upsert wallet to DB
```
No third-party OAuth. The wallet *is* the identity. Uses `window.phantom.solana` directly (no wallet-adapter-react timing issues).

### Helius RPC
- `getBalance` — SOL balance in lamports, converted to USD
- `getTokenAccountsByOwner` — USDC devnet (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- Auto-fallback to `api.devnet.solana.com` if env not configured

### Kamino Lending (real DeFi)
- Market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF` (devnet)
- Adapter: `deposit(amountUsd)` / `withdraw(amountUsd)` / `getPosition()`
- Externalized from Turbopack bundle via `serverExternalPackages`

### Transaction Lifecycle
```
buildTx() → signAndSend() via Phantom → confirmTx() polling
  └── or: SIM-<timestamp> in simulated mode (no chain interaction)
```

### Intent State Machine
```
DRAFT → PROPOSED → APPROVED → QUEUED → SIGNING → BROADCAST → CONFIRMED
                                                             → REJECTED / FAILED
```

---

## AI / Anthropic Integration

### Copilot Chat (`/api/copilot`)
- **Model:** `claude-sonnet-4-6` with streaming (`ReadableStream` → `getReader()`)
- **Context injected into system prompt:** current snapshot + active policy
- **Prompt caching** (`cache_control: ephemeral`) — ~80% cost reduction after first turn
- **Tool-use loop:** streaming continues through multiple tool calls until `end_turn` — no mid-response cutoffs
- **AbortController** — stop stream button works mid-generation
- **5 tools with guardrails:**

| Tool | What It Does |
|---|---|
| `analyze_treasury` | Full diagnostic of current treasury state |
| `explain_policy` | Plain-language breakdown of active policy rules |
| `propose_allocation` | Validates against min runway before proposing any move |
| `simulate_scenario` | Runs `projectScenario()` inline and returns projection diff |
| `draft_policy_from_description` | NL description → `PolicyRule[]` JSON (uses Opus 4.7) |

### Policy from Natural Language
```
Input:  "quero manter 6 meses de runway e no máximo 40% em um único protocolo"
Output: { preset: "balanced", rules: PolicyRule[] }
  → applied to PolicyBuilder UI state → user reviews → saves
```
Strips markdown code fences from response before JSON.parse (robust to model formatting variance).

### Executive Summary (for PDF)
- Separate Server Action, no streaming
- All treasury KPIs structured in prompt
- ≤150 words, PT-BR, direct founder tone
- Embedded in PDF export automatically

---

## Rules Engine

Pure TypeScript module at `src/lib/rules-engine/` — zero I/O, zero server dependencies. Runs on the server (dashboard, alerts) and the client (simulator real-time updates via `useMemo`).

| Function | Output |
|---|---|
| `projectRunway(snapshot, policy)` | runway months, deployed%, blended APR, compliance score, violations |
| `projectScenario(snapshot, policy, deltas)` | same, on a hypothetical state after simulated moves |
| `computeAlerts(snapshot, policy)` | runway / concentration / obligation / policy alerts |
| `validateActions(intents, snapshot, policy)` | go/no-go + block reason before execution |

**Policy presets:**

| | Conservative | Balanced | Aggressive |
|---|---|---|---|
| Min runway | 180 days | 90 days | 60 days |
| Max concentration | 30% | 45% | 60% |
| Min liquidity | 70% | 50% | 30% |

---

## Database — 13 Tables

```
organizations    — org profile, base currency, monthly burn
users            — mirror of Supabase auth.users + full_name, phone, country
memberships      — org × user × role (owner / admin / viewer)
wallets          — Solana addresses linked to org
snapshots        — point-in-time treasury photo (totals + positions JSON)
policies         — versioned, status draft/active/archived, rules in JSONB
buckets          — allocation categories (operating/payroll/tax/emergency/yield)
obligations      — fixed expenses with due date and recurrence
intents          — approved moves: DRAFT→CONFIRMED state machine
recommendations  — suggestions from Simulator/Copilot pending approval
events           — on-chain events received via Helius webhook
audit_log        — human action log with JSON diff
mock_positions   — simulated Mock RWA adapter positions
```

RLS active on all tables by `org_id`. Trigger syncs `auth.users → public.users` on signup.

---

## Getting Started

### Prerequisites
- Node.js 20+
- Supabase project (free tier)
- Helius API key (free tier)
- Anthropic API key
- Phantom wallet set to devnet

### Setup

```bash
git clone https://github.com/Nogcrypto/treasury_os.git
cd treasury_os
npm install          # also runs patch-package (fixes rpc-websockets/uuid ESM)
cp .env.local.example .env.local
# Fill in your credentials (see below)
npm run dev
# → http://localhost:3000
```

### Schema

Run in **Supabase SQL Editor** in order:
```sql
-- 1. Apply schema (13 tables + RLS + triggers)
\i drizzle/migrations/0000_initial.sql

-- 2. Add user profile fields
\i drizzle/migrations/0002_users_profile_fields.sql

-- 3. Optional: seed test data
\i drizzle/seed.sql
```

### Environment Variables

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

---

## Deploy

```
Vercel (gru1 — São Paulo):   https://treasury-os-black.vercel.app
Supabase project:            joeyutliqcqcefeidsdf
GitHub (auto-deploy):        github.com/Nogcrypto/treasury_os  [master]
```

The Supabase Edge Function at `supabase/functions/snapshot-cron/` runs on Deno and is scheduled every 5 min via `pg_cron` to auto-snapshot all registered wallets.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/           dashboard · policy · copilot · simulator · execution · reports
│   ├── (auth)/          login · register · forgot-password · magic link callback
│   ├── (onboarding)/    4-step setup wizard
│   └── api/             trpc · copilot (streaming) · setup · helius webhook
├── components/
│   ├── AppShell.tsx          responsive sidebar nav (hamburger on mobile)
│   ├── AlertsBanner.tsx      4-type alert system
│   ├── Copilot.tsx           streaming chat UI with abort
│   ├── PolicyBuilder.tsx     rule editor + AI generation
│   ├── Simulator.tsx         real-time projection sliders + hypothetical mode
│   ├── ExecutionDrawer.tsx   intent state machine UI
│   ├── PdfExportButton.tsx   jsPDF client-side export
│   ├── ProfilePanel.tsx      user profile + wallet connect modal
│   ├── dashboard/            KpiGrid · BucketCard · PositionsTable · SnapshotButton
│   └── onboarding/           SetupWizard (4 steps + direct Phantom API)
├── lib/
│   ├── adapters/        kamino.ts · mock-rwa.ts
│   ├── agent/           client.ts (tool-use loop) · tools.ts · prompts.ts
│   ├── db/              schema.ts (13 tables) · client.ts
│   ├── demo/            index.ts — $847k mock data for dev@capivara.xyz
│   ├── rules-engine/    projections · alerts · validation · policy presets
│   ├── solana/          wallet.tsx (direct Phantom API) · siws.ts · indexer.ts · tx.ts
│   └── supabase/        client (browser) · server
└── server/
    ├── trpc.ts          context (isDemoUser flag) · procedures
    └── routers/         org · snapshot · bucket · obligation · policy · intent · recommendation
patches/
└── rpc-websockets+9.3.9.patch   fixes require('uuid') ESM incompatibility
supabase/functions/snapshot-cron/    Deno edge function
drizzle/migrations/                  SQL schema + migrations
docs/                                TECHNICAL.md · PLAN.md · Backlog.md
```

---

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type-check
```

---

<div align="center">
  <p>Built for <strong>Solana Frontier Hackathon</strong> · Solo project</p>
  <p><em>"Startups don't fail because they ran out of ideas — they fail because they ran out of runway.<br>TreasuryOS makes sure you always know exactly how long you have."</em></p>
  <br/>
  <p>Made with Solana · Anthropic Claude · Next.js · ☕</p>
</div>
