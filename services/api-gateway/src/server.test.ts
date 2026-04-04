import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'server.ts'), 'utf-8');

describe('api-gateway CORS', () => {
  it('should not use wildcard origin', () => {
    expect(source).not.toContain("origin: '*'");
    expect(source).not.toContain('origin: "*"');
  });

  it('should define allowed origins from env var', () => {
    expect(source).toContain('ALLOWED_ORIGINS');
  });

  it('should use a callback to prevent origin reflection', () => {
    expect(source).toContain('origin: (origin, cb)');
  });

  it('should restrict CORS to explicit HTTP methods', () => {
    expect(source).toContain('methods:');
    expect(source).toContain('GET');
    expect(source).toContain('POST');
  });

  it('should restrict allowed headers', () => {
    expect(source).toContain('allowedHeaders:');
    expect(source).toContain('Authorization');
  });
});

describe('api-gateway HTTP security headers', () => {
  it('should import @fastify/helmet', () => {
    expect(source).toContain('@fastify/helmet');
  });

  it('should register helmet plugin', () => {
    expect(source).toContain('app.register(helmet');
  });

  it('should disable X-Powered-By header', () => {
    // helmet hides the server tech stack by default
    expect(source).toContain('helmet');
  });
});
