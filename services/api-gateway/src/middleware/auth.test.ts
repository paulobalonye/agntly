import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('auth middleware secrets', () => {
  it('should not contain hardcoded internal signing secret', () => {
    const source = readFileSync(resolve(__dirname, 'auth.ts'), 'utf-8');
    expect(source).not.toContain('dev-internal-secret-not-for-production');
    expect(source).not.toContain("return '");
    // Should require INTERNAL_SIGNING_SECRET in all environments
  });

  it('should require INTERNAL_SIGNING_SECRET environment variable', () => {
    const source = readFileSync(resolve(__dirname, 'auth.ts'), 'utf-8');
    expect(source).toContain('INTERNAL_SIGNING_SECRET');
    // Should throw/exit if not set, no fallback
  });
});
