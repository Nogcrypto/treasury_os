# TreasuryOS

CFO operacional onchain para startups web3 na Solana. Solana Frontier Hackathon.

## Setup local

### 1. Instalar dependências

```bash
npm install
cp .env.local.example .env.local
# Preencher .env.local com as credenciais abaixo
```

### 2. Criar projeto no Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New project
2. Copiar **Project URL** e **anon key** → `.env.local`
3. Copiar **service_role key** → `.env.local`
4. Em **Settings → Database**, copiar a **Transaction pooler URL** → `DATABASE_URL`

### 3. Rodar a migração

No Supabase dashboard → **SQL Editor**, colar e executar:

```
drizzle/migrations/0000_initial.sql
```

Opcionalmente, para dados de teste:

```
drizzle/seed.sql
```

*(Ajuste o UUID do usuário para o seu — veja comentários no arquivo)*

### 4. Configurar Helius

1. [helius.xyz](https://helius.xyz) → criar conta → copiar API key
2. Preencher `HELIUS_API_KEY` e `HELIUS_RPC_URL` no `.env.local`

### 5. Configurar Anthropic

1. [console.anthropic.com](https://console.anthropic.com) → API Keys → criar key
2. Preencher `ANTHROPIC_API_KEY`

### 6. Rodar

```bash
npm run dev
# http://localhost:3000
```

## Estrutura

```
src/
  app/
    (auth)/login/       magic link login
    auth/callback/      Supabase OAuth callback
    (app)/dashboard/    cockpit principal
    api/trpc/[trpc]/    tRPC handler
    api/webhooks/helius/ intake de eventos onchain
  lib/
    db/                 Drizzle schema + client
    rules-engine/       projectRunway, validateAction (puro, testável)
    adapters/           Kamino devnet + Mock RWA
    agent/              Claude tools + prompt caching
    solana/             indexer Helius
    supabase/           client browser + server
  server/
    routers/intent.ts   state machine DRAFT→CONFIRMED
    trpc.ts             procedures (public / protected / org)
drizzle/
  migrations/0000_initial.sql   schema completo + RLS
  seed.sql                      dados de teste
middleware.ts                   session refresh + auth guard
prototype/                      HTML prototype (referência visual)
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # build produção
npm run lint       # ESLint
npx tsc --noEmit   # type-check
```
