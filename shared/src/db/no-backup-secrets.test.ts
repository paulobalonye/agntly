import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

describe('no secret backup files', () => {
  it('should not have .env.production.backup', () => {
    expect(existsSync(resolve(ROOT, '.env.production.backup'))).toBe(false);
  });

  it('should not have .env.sandbox.backup', () => {
    expect(existsSync(resolve(ROOT, '.env.sandbox.backup'))).toBe(false);
  });

  it('should have *.backup in .gitignore', () => {
    const gitignore = require('node:fs').readFileSync(resolve(ROOT, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('*.backup');
  });
});
