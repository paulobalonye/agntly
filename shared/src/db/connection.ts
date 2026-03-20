import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createPool(connectionString?: string) {
  const connStr = connectionString ?? process.env.DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly';
  if (connStr.includes('agntly:agntly') && process.env.NODE_ENV === 'production') {
    console.error('FATAL: Using default database credentials in production');
    process.exit(1);
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
