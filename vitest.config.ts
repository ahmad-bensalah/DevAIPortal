import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'agent/tests/**/*.test.ts',
      'agent/eval/**/*.test.ts',
      'adapters/**/tests/**/*.test.ts',
      'config/**/*.test.ts',
      'docs/**/*.test.ts',
      'charts/**/*.test.ts',
      'policies/**/*.test.ts',
      'gitops/**/*.test.ts',
      'n8n/**/*.test.ts',
    ],
    globals: false,
    testTimeout: 10000,
  },
});
