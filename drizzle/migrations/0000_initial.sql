-- TreasuryOS — initial schema
-- Run in Supabase dashboard → SQL Editor, or via: npx drizzle-kit push

-- ── Enums ────────────────────────────────────────────────────────────────────

create type org_profile       as enum ('startup', 'dao', 'fund');
create type member_role       as enum ('owner', 'admin', 'viewer');
create type policy_status     as enum ('draft', 'active', 'archived');
create type policy_preset     as enum ('conservative', 'balanced', 'aggressive', 'custom');
create type bucket_kind       as enum ('operating', 'payroll', 'tax', 'emergency', 'yield', 'custom');
create type recurrence        as enum ('once', 'monthly', 'quarterly', 'annual');
create type intent_kind       as enum ('deposit', 'withdraw', 'rebalance');
create type intent_status     as enum (
  'draft', 'proposed', 'approved', 'queued',
  'signing', 'broadcast', 'confirmed', 'rejected', 'failed', 'expired'
);
create type execution_status  as enum ('pending', 'confirmed', 'failed');

-- ── Core tables ───────────────────────────────────────────────────────────────

create table organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  profile          org_profile not null default 'startup',
  base_currency    text not null default 'USDC',
  simulated_mode   boolean not null default true,
  monthly_burn_usd integer not null default 0,
  created_at       timestamptz not null default now()
);

-- Mirror of auth.users — populated via trigger
create table users (
  id         uuid primary key,  -- same as auth.users.id
  email      text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role    member_role not null default 'owner',
  unique (org_id, user_id)
);

create table wallets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  address    text not null,
  label      text,
  is_primary boolean not null default false,
  unique (org_id, address)
);

create table policies (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  version      integer not null default 1,
  status       policy_status not null default 'draft',
  preset       policy_preset not null default 'balanced',
  json_spec    jsonb not null,
  created_by   uuid references users(id),
  activated_at timestamptz,
  created_at   timestamptz not null default now()
);

create table buckets (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  kind                bucket_kind not null,
  label               text,
  target_amount_cents bigint not null default 0,
  target_pct          integer,
  currency            text not null default 'USDC'
);

create table obligations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  bucket_id    uuid references buckets(id) on delete set null,
  label        text not null,
  amount_cents bigint not null,
  due_date     timestamptz not null,
  recurrence   recurrence not null default 'once'
);

create table snapshots (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  taken_at       timestamptz not null default now(),
  totals_json    jsonb not null,
  positions_json jsonb not null,
  buckets_json   jsonb not null
);

create table recommendations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  policy_version integer not null,
  created_at     timestamptz not null default now(),
  rationale      text,
  actions_json   jsonb not null,
  status         text not null default 'pending'
);

create table intents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  recommendation_id uuid references recommendations(id) on delete set null,
  kind              intent_kind not null,
  params_json       jsonb not null,
  status            intent_status not null default 'draft',
  idempotency_key   text not null unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table executions (
  id           uuid primary key default gen_random_uuid(),
  intent_id    uuid not null references intents(id) on delete cascade,
  tx_signature text unique,
  status       execution_status not null default 'pending',
  onchain_at   timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create table events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  type         text not null,
  payload_json jsonb not null,
  created_at   timestamptz not null default now()
);

create table audit_log (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organizations(id) on delete cascade,
  actor     uuid references users(id),
  action    text not null,
  target    text not null,
  diff_json jsonb,
  at        timestamptz not null default now()
);

create table mock_positions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  adapter_id       text not null default 'mock-rwa-usdy',
  amount_usd       integer not null default 0,
  accrued_yield_usd integer not null default 0,
  deposited_at     timestamptz not null default now(),
  redeemable_at    timestamptz not null
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index wallets_org_idx          on wallets(org_id);
create index policies_org_idx         on policies(org_id);
create index buckets_org_idx          on buckets(org_id);
create index obligations_org_idx      on obligations(org_id);
create index snapshots_org_taken_idx  on snapshots(org_id, taken_at);
create index reco_org_idx             on recommendations(org_id);
create index intents_org_idx          on intents(org_id);
create index executions_intent_idx    on executions(intent_id);
create index events_org_type_idx      on events(org_id, type);
create index audit_org_idx            on audit_log(org_id);
create index mock_positions_org_idx   on mock_positions(org_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table organizations   enable row level security;
alter table memberships     enable row level security;
alter table wallets         enable row level security;
alter table policies        enable row level security;
alter table buckets         enable row level security;
alter table obligations     enable row level security;
alter table snapshots       enable row level security;
alter table recommendations enable row level security;
alter table intents         enable row level security;
alter table executions      enable row level security;
alter table events          enable row level security;
alter table audit_log       enable row level security;
alter table mock_positions  enable row level security;
-- users table: not RLS'd — service role only writes it

-- Helper function: returns org_ids the current user is a member of
create or replace function user_org_ids()
returns setof uuid
language sql
stable security definer
as $$
  select org_id from memberships where user_id = auth.uid()
$$;

-- RLS policies (select + insert + update + delete scoped to membership)
create policy "org_members_select" on organizations
  for select using (id in (select user_org_ids()));

create policy "org_members_select" on wallets
  for select using (org_id in (select user_org_ids()));
create policy "org_members_insert" on wallets
  for insert with check (org_id in (select user_org_ids()));
create policy "org_members_update" on wallets
  for update using (org_id in (select user_org_ids()));

create policy "org_members_select" on policies
  for select using (org_id in (select user_org_ids()));
create policy "org_members_insert" on policies
  for insert with check (org_id in (select user_org_ids()));
create policy "org_members_update" on policies
  for update using (org_id in (select user_org_ids()));

create policy "org_members_select" on buckets
  for select using (org_id in (select user_org_ids()));
create policy "org_members_insert" on buckets
  for insert with check (org_id in (select user_org_ids()));
create policy "org_members_update" on buckets
  for update using (org_id in (select user_org_ids()));
create policy "org_members_delete" on buckets
  for delete using (org_id in (select user_org_ids()));

create policy "org_members_select" on obligations
  for select using (org_id in (select user_org_ids()));
create policy "org_members_insert" on obligations
  for insert with check (org_id in (select user_org_ids()));
create policy "org_members_update" on obligations
  for update using (org_id in (select user_org_ids()));
create policy "org_members_delete" on obligations
  for delete using (org_id in (select user_org_ids()));

create policy "org_members_select" on snapshots
  for select using (org_id in (select user_org_ids()));

create policy "org_members_select" on recommendations
  for select using (org_id in (select user_org_ids()));

create policy "org_members_select" on intents
  for select using (org_id in (select user_org_ids()));
create policy "org_members_insert" on intents
  for insert with check (org_id in (select user_org_ids()));
create policy "org_members_update" on intents
  for update using (org_id in (select user_org_ids()));

create policy "org_members_select" on executions
  for select using (
    intent_id in (select id from intents where org_id in (select user_org_ids()))
  );

create policy "org_members_select" on events
  for select using (org_id in (select user_org_ids()));

create policy "org_members_select" on audit_log
  for select using (org_id in (select user_org_ids()));

create policy "org_members_select" on mock_positions
  for select using (org_id in (select user_org_ids()));

-- ── Trigger: sync auth.users → public.users ───────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── pg_cron: snapshot every 5 minutes (Semana 2) ─────────────────────────────
-- Enable via: create extension if not exists pg_cron;
-- select cron.schedule('treasury-snapshot', '*/5 * * * *',
--   $$select net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/snapshot-cron',
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   )$$
-- );
