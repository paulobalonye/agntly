// Set required secrets before any imports that trigger module-level assertions
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-at-least-32-characters-long';
process.env.COMPLETION_TOKEN_SECRET = process.env.COMPLETION_TOKEN_SECRET ?? 'test-completion-secret-at-least-32-chars';

import pg from 'pg';
import IORedis from 'ioredis';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly_test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';

let pool: pg.Pool;
let redis: InstanceType<typeof IORedis>;

export async function setupTestDb() {
  const adminPool = new pg.Pool({
    connectionString: 'postgresql://agntly:agntly@localhost:5432/agntly',
  });

  try {
    await adminPool.query('CREATE DATABASE agntly_test');
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== '42P04') throw err;
  }
  await adminPool.end();

  pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 20 });

  const migrationSql = readFileSync(resolve(process.cwd(), 'scripts/migrate.sql'), 'utf-8');
  await pool.query(migrationSql);

  redis = new IORedis(TEST_REDIS_URL);

  const db = drizzle(pool);
  return { db, pool, redis };
}

export async function cleanTestDb() {
  if (!pool) return;
  await pool.query(`
    TRUNCATE TABLE
      webhook_deliveries,
      webhook_subscriptions,
      task_audit_log,
      escrow_audit_log,
      agent_reviews,
      invoices,
      subscriptions,
      payments,
      deposits,
      withdrawals,
      escrows,
      tasks,
      api_keys,
      refresh_tokens,
      agents,
      wallets,
      users
    CASCADE
  `);
}

export async function teardownTestDb() {
  if (redis) {
    await redis.flushdb();
    await redis.quit();
  }
  if (pool) {
    await pool.end();
  }
}

export { pool, redis, TEST_DB_URL, TEST_REDIS_URL };
