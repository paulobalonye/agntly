import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SQL_PATH = resolve(__dirname, 'rls-policies.sql');

const TABLES = [
  'users',
  'api_keys',
  'refresh_tokens',
  'magic_link_tokens',
  'wallets',
  'deposits',
  'withdrawals',
  'escrows',
  'escrow_audit_log',
  'tasks',
  'task_audit_log',
  'agents',
  'agent_reviews',
  'payments',
  'subscriptions',
  'invoices',
  'webhook_subscriptions',
  'webhook_deliveries',
  'licenses',
  'spending_policies',
  'kyc_records',
  'bank_accounts',
  'fiat_transfers',
];

describe('RLS policies SQL', () => {
  it('rls-policies.sql should exist', () => {
    expect(existsSync(SQL_PATH)).toBe(true);
  });

  it('should enable RLS on every table', () => {
    const sql = readFileSync(SQL_PATH, 'utf-8');
    for (const table of TABLES) {
      expect(sql, `Missing ENABLE ROW LEVEL SECURITY on ${table}`).toContain(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
      );
    }
  });

  it('should define at least one policy per table', () => {
    const sql = readFileSync(SQL_PATH, 'utf-8');
    for (const table of TABLES) {
      expect(sql, `Missing CREATE POLICY on ${table}`).toContain(`ON ${table}`);
    }
  });

  it('should not grant unrestricted public access', () => {
    const sql = readFileSync(SQL_PATH, 'utf-8');
    // No "TO PUBLIC" or "TO public" that isn't explicitly intended
    const publicPolicies = sql.match(/CREATE POLICY[^;]+TO public[^;]+;/gi) ?? [];
    expect(publicPolicies.length, 'Unexpected public role policies found').toBe(0);
  });
});
