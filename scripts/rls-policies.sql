-- ============================================================
-- Row Level Security (RLS) Policies
-- Run this after migrate.sql on every environment.
--
-- Strategy: enable RLS on every table, then grant the
-- application service role (agntly) unrestricted access.
-- Any direct DB connection that does NOT use the app role is
-- blocked by default.  Future Supabase-aware policies will
-- layer user-scoped filtering on top using auth.uid().
-- ============================================================

-- ------------------------------------------------------------
-- AUTH SERVICE
-- ------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE magic_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_link_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON users
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON api_keys
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON refresh_tokens
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON magic_link_tokens
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- WALLET SERVICE
-- ------------------------------------------------------------
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets FORCE ROW LEVEL SECURITY;

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits FORCE ROW LEVEL SECURITY;

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON wallets
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON deposits
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON withdrawals
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- ESCROW ENGINE
-- ------------------------------------------------------------
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows FORCE ROW LEVEL SECURITY;

ALTER TABLE escrow_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON escrows
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON escrow_audit_log
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- TASK SERVICE
-- ------------------------------------------------------------
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON tasks
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON task_audit_log
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- REGISTRY SERVICE
-- ------------------------------------------------------------
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON agents
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON agent_reviews
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- PAYMENT SERVICE
-- ------------------------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON payments
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON subscriptions
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON invoices
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- WEBHOOK SERVICE
-- ------------------------------------------------------------
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON webhook_subscriptions
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON webhook_deliveries
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- LICENSE SERVICE
-- ------------------------------------------------------------
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON licenses
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- SPENDING POLICIES
-- ------------------------------------------------------------
ALTER TABLE spending_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON spending_policies
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- KYC RECORDS
-- ------------------------------------------------------------
ALTER TABLE kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON kyc_records
  FOR ALL TO agntly USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- FIAT (BANK ACCOUNTS + TRANSFERS)
-- ------------------------------------------------------------
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE fiat_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_transfers FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON bank_accounts
  FOR ALL TO agntly USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access" ON fiat_transfers
  FOR ALL TO agntly USING (true) WITH CHECK (true);
