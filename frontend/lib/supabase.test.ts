import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LIB_PATH = resolve(__dirname, 'supabase.ts');

describe('frontend Supabase client', () => {
  it('supabase.ts should exist', () => {
    expect(existsSync(LIB_PATH)).toBe(true);
  });

  it('should read NEXT_PUBLIC_SUPABASE_URL from env', () => {
    const src = readFileSync(LIB_PATH, 'utf-8');
    expect(src).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('should read NEXT_PUBLIC_SUPABASE_ANON_KEY from env', () => {
    const src = readFileSync(LIB_PATH, 'utf-8');
    expect(src).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('should not hardcode any Supabase keys', () => {
    const src = readFileSync(LIB_PATH, 'utf-8');
    expect(src).not.toContain('sb_publishable_');
    expect(src).not.toContain('sb_secret_');
  });

  it('should export a browser client creator and a server client creator', () => {
    const src = readFileSync(LIB_PATH, 'utf-8');
    expect(src).toContain('createBrowserClient');
    expect(src).toContain('createServerClient');
  });
});
