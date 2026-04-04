import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createPool(connectionString?: string) {
  const connStr = connectionString ?? process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return new pg.Pool({
    connectionString: connStr,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export function createDbConnection(connectionString?: string) {
  const pool = createPool(connectionString);
  return drizzle(pool);
}

export type DbConnection = ReturnType<typeof createDbConnection>;
export type DbPool = pg.Pool;
