-- Seed de desenvolvimento — Capivara Labs (org de teste)
-- Execute APÓS a migração 0000_initial.sql

-- 1. Criar usuário de teste no Supabase Auth via dashboard/CLI
--    supabase auth create-user --email dev@capivara.xyz
--    Anote o UUID gerado e substitua abaixo.

-- 2. Inserir usuário na tabela pública (trigger faz isso automaticamente,
--    mas inserimos manualmente para seed sem trigger)
insert into users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dev@capivara.xyz')
  on conflict (id) do nothing;

-- 3. Criar org
insert into organizations (id, name, profile, monthly_burn_usd, simulated_mode) values
  ('00000000-0000-0000-0000-000000000010', 'Capivara Labs', 'startup', 120000, true);

-- 4. Membership
insert into memberships (org_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'owner');

-- 5. Wallet devnet
insert into wallets (org_id, address, label, is_primary) values
  ('00000000-0000-0000-0000-000000000010', '8xZkhpN5fA2vRtQ7Y9HmEbW3CkP4nL6dN3qP', 'Phantom Devnet', true);

-- 6. Política balanced ativa
insert into policies (org_id, version, status, preset, json_spec, activated_at) values
  ('00000000-0000-0000-0000-000000000010', 1, 'active', 'balanced', '[
    {"id":"MIN_RUNWAY_DAYS","enabled":true,"params":{"days":90}},
    {"id":"MAX_CONCENTRATION_PCT","enabled":true,"params":{"pct":45}},
    {"id":"MIN_LIQUID_PCT","enabled":true,"params":{"pct":50}},
    {"id":"ALLOCATION_WHITELIST","enabled":true,"params":{"adapters":["kamino-usdc-devnet","mock-rwa-usdy"]}},
    {"id":"YIELD_ONLY_EXCESS","enabled":true,"params":{}},
    {"id":"REBALANCE_TRIGGER","enabled":true,"params":{"deviationPct":10}},
    {"id":"BUCKET_TARGET","enabled":true,"params":{}}
  ]'::jsonb, now());

-- 7. Buckets
insert into buckets (org_id, kind, label, target_amount_cents) values
  ('00000000-0000-0000-0000-000000000010', 'operating', 'Operacional',  24000000),
  ('00000000-0000-0000-0000-000000000010', 'payroll',   'Folha',         8850000),
  ('00000000-0000-0000-0000-000000000010', 'tax',       'Impostos',      6400000),
  ('00000000-0000-0000-0000-000000000010', 'emergency', 'Reserva',      10000000),
  ('00000000-0000-0000-0000-000000000010', 'yield',     'Excedente',            0);

-- 8. Obrigações
insert into obligations (org_id, label, amount_cents, due_date, recurrence) values
  ('00000000-0000-0000-0000-000000000010', 'Folha de pagamento',   9600000, now() + interval '26 days', 'monthly'),
  ('00000000-0000-0000-0000-000000000010', 'Vendor — Helius infra',1250000, now() + interval '33 days', 'monthly'),
  ('00000000-0000-0000-0000-000000000010', 'AWS + Vercel',          680000, now() + interval '41 days', 'monthly'),
  ('00000000-0000-0000-0000-000000000010', 'Imposto trimestral',   5400000, now() + interval '66 days', 'quarterly');

-- 9. Snapshot inicial (posições mockadas)
insert into snapshots (org_id, totals_json, positions_json, buckets_json) values
  ('00000000-0000-0000-0000-000000000010',
    '{"totalUsd":812440,"liquidUsd":492440}',
    '[
      {"adapterId":"kamino-usdc-devnet","protocol":"Kamino","asset":"USDC","amountUsd":250000,"aprPct":5.84,"accruedYieldUsd":218.40,"riskTier":1,"unlockDays":0},
      {"adapterId":"mock-rwa-usdy","protocol":"Mock RWA (USDY-like)","asset":"USDY","amountUsd":70000,"aprPct":4.82,"accruedYieldUsd":41.20,"riskTier":2,"unlockDays":1}
    ]',
    '{"operating":240000,"payroll":88500,"tax":64000,"emergency":100000,"yield":319940}'
  );
