-- Migration: Equity Studio tables
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS equity_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mint                  TEXT NOT NULL,
  symbol                VARCHAR(12) NOT NULL,
  name                  VARCHAR(64) NOT NULL,
  decimals              INTEGER NOT NULL DEFAULT 6,
  total_supply          BIGINT,
  price_usdc_e6         BIGINT,           -- price × 1_000_000 for precision
  pool_address          TEXT,
  pool_apr_bps          INTEGER,           -- APR in basis points (e.g. 1840 = 18.40%)
  total_dividends_cents BIGINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS equity_tokens_org_idx ON equity_tokens(org_id);

ALTER TABLE equity_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY equity_tokens_org_rls ON equity_tokens
  USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS equity_dividends (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_mint       TEXT NOT NULL,
  amount_cents     BIGINT NOT NULL,
  per_token_usdc   TEXT,
  recipients_count INTEGER,
  tx_signature     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | failed
  distributed_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equity_dividends_org_idx ON equity_dividends(org_id);

ALTER TABLE equity_dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY equity_dividends_org_rls ON equity_dividends
  USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );
