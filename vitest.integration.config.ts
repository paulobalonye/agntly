import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@agntly/shared': resolve(import.meta.dirname, 'shared/src/index.ts'),
    },
  },
  test: {
    env: {
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      COMPLETION_TOKEN_SECRET: 'test-completion-secret-at-least-32-chars',
    },
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
