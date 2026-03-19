import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createDbConnection(connectionString?: string) {
  const pool = new pg.Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return drizzle(pool);
}

export type DbConnection = ReturnType<typeof createDbConnection>;
