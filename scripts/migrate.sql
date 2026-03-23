-- Agntly Full Schema Migration
-- Run against each service database or a single combined database

-- ============================================
-- AUTH SERVICE
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('developer', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'developer',
  kyc_status kyc_status NOT NULL DEFAULT 'none',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);

-- ============================================
-- WALLET SERVICE
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  agent_id TEXT,
  address TEXT NOT NULL UNIQUE,
  balance NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
  locked NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
  chain TEXT NOT NULL DEFAULT 'base-sepolia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount_usd NUMERIC(12,2) NOT NULL,
  usdc_amount NUMERIC(18,6) NOT NULL,
  method TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount NUMERIC(18,6) NOT NULL,
  destination TEXT NOT NULL,
  fee NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id);
CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_id);

-- ============================================
-- ESCROW ENGINE
-- ============================================
DO $$ BEGIN
  CREATE TYPE escrow_state AS ENUM ('locked', 'released', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  from_wallet_id UUID NOT NULL,
  to_wallet_id UUID NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  fee NUMERIC(18,6) NOT NULL,
  state escrow_state NOT NULL DEFAULT 'locked',
  tx_hash TEXT,
  result_hash TEXT,
  dispute_reason TEXT,
  dispute_evidence TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS escrow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrows(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrows_task ON escrows(task_id);
CREATE INDEX IF NOT EXISTS idx_escrows_state ON escrows(state);

-- ============================================
-- TASK SERVICE
-- ============================================
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending', 'escrowed', 'dispatched', 'complete', 'failed', 'disputed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  orchestrator_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  result JSONB,
  status task_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(18,6) NOT NULL,
  fee NUMERIC(18,6) NOT NULL,
  escrow_tx TEXT,
  settle_tx TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  status task_status NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_orchestrator ON tasks(orchestrator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);

-- ============================================
-- REGISTRY SERVICE
-- ============================================
DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM ('active', 'paused', 'delisted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  price_usdc NUMERIC(10,6) NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status agent_status NOT NULL DEFAULT 'active',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  reputation NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  calls_total INTEGER NOT NULL DEFAULT 0,
  calls_last_24h INTEGER NOT NULL DEFAULT 0,
  uptime_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  featured_until TIMESTAMPTZ,
  registry_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_agents_calls ON agents(calls_total DESC);

-- ============================================
-- PAYMENT SERVICE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  amount_usd NUMERIC(12,2) NOT NULL,
  usdc_amount NUMERIC(18,6),
  method TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  circle_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  stripe_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ============================================
-- WEBHOOK SERVICE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id),
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE delivered_at IS NULL AND failed_at IS NULL;

-- ============================================
-- LICENSE SERVICE
-- ============================================
DO $$ BEGIN
  CREATE TYPE license_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code TEXT NOT NULL UNIQUE,
  buyer_email TEXT,
  buyer_name TEXT,
  domain TEXT,
  license_type TEXT NOT NULL DEFAULT 'regular',
  envato_item_id TEXT,
  envato_buyer TEXT,
  status license_status NOT NULL DEFAULT 'active',
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_purchase_code ON licenses(purchase_code);
CREATE INDEX IF NOT EXISTS idx_licenses_domain ON licenses(domain);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- ============================================
-- SPENDING POLICIES
-- ============================================
CREATE TABLE IF NOT EXISTS spending_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  per_transaction_max NUMERIC(18,6),
  daily_budget NUMERIC(18,6),
  monthly_budget NUMERIC(18,6),
  lifetime_budget NUMERIC(18,6),
  allowed_categories TEXT[] NOT NULL DEFAULT '{}',
  allowed_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  allowed_owner_ids TEXT[] NOT NULL DEFAULT '{}',
  blocked_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  max_price_per_call NUMERIC(18,6),
  min_reputation NUMERIC(3,2),
  verified_only BOOLEAN NOT NULL DEFAULT FALSE,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_owner ON spending_policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_policies_active ON spending_policies(owner_id, active) WHERE active = TRUE;

-- ============================================
-- DONE
-- ============================================
