import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts',
        'deploy-commands.ts',
        'src/index.ts',
        'src/scripts/**',
        'src/workers/**',
        'src/__tests__/**',
        'scripts/**',
      ],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 90,
        statements: 90,
      },
    },
    include: ['src/**/*.{test,spec}.ts'],
    testTimeout: 10000,
  },
});
