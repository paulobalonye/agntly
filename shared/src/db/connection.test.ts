import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createPool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    const { createPool } = await import('./connection.js');
    expect(() => createPool()).toThrow('DATABASE_URL');
  });

  it('should use DATABASE_URL from environment', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    const { createPool } = await import('./connection.js');
    const pool = createPool();
    expect(pool).toBeDefined();
    await pool.end();
  });

  it('should use explicit connectionString over environment', async () => {
    process.env.DATABASE_URL = 'postgresql://env:env@host:5432/envdb';
    const { createPool } = await import('./connection.js');
    const pool = createPool('postgresql://explicit:explicit@host:5432/explicitdb');
    expect(pool).toBeDefined();
    await pool.end();
  });

  it('should not contain hardcoded credentials in source', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./connection.ts', import.meta.url), 'utf-8');
    expect(source).not.toContain('agntly:agntly');
    expect(source).not.toContain('postgresql://agntly');
  });
});
