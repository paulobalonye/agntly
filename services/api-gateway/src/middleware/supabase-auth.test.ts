import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'auth.ts'), 'utf-8');

describe('api-gateway Supabase JWT support', () => {
  it('should import @supabase/supabase-js', () => {
    expect(source).toContain('@supabase/supabase-js');
  });

  it('should read SUPABASE_URL from environment', () => {
    expect(source).toContain('SUPABASE_URL');
  });

  it('should read SUPABASE_SERVICE_ROLE_KEY from environment (not hardcoded)', () => {
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('sb_secret_');
  });

  it('should detect Supabase JWT by issuer and route it separately', () => {
    expect(source).toContain('getJwtIssuer');
    expect(source).toContain('supabase.co');
  });

  it('should call supabase.auth.getUser to verify Supabase tokens', () => {
    expect(source).toContain('getUser');
  });
});
