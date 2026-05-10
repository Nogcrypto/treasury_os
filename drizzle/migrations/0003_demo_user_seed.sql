-- Migration: configure demo user dev@capivara.xyz
-- Run this in Supabase SQL Editor (requires pgcrypto extension)

-- 1. Set password for the demo account (Supabase Auth layer)
UPDATE auth.users
SET
  encrypted_password = crypt('Senha@123', gen_salt('bf')),
  updated_at         = now()
WHERE email = 'dev@capivara.xyz';

-- 2. Upsert profile fields in public.users
INSERT INTO public.users (id, email, full_name, phone, country, created_at)
SELECT
  id,
  email,
  'Capivara Ventures',
  NULL,
  'Brasil',
  created_at
FROM auth.users
WHERE email = 'dev@capivara.xyz'
ON CONFLICT (id) DO UPDATE
  SET
    full_name = 'Capivara Ventures',
    country   = 'Brasil';
