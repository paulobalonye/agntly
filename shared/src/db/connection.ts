import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createPool(connectionString?: string) {
  return new pg.Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly',
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
