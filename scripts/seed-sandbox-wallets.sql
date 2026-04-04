-- Seed sandbox wallets with test USDC balance for end-to-end task flow testing.
-- Safe to run multiple times (idempotent — only updates wallets with zero balance).
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seed-sandbox-wallets.sql

UPDATE wallets
SET balance = '10000.000000'
WHERE balance = '0.000000';
