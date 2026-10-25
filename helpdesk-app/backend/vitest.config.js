import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Local convenience: load helpdesk-app/.env if present. CI sets variables directly.
if (existsSync('../.env')) process.loadEnvFile('../.env');

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/setup/globalSetup.js'],
    // Integration tests share one database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/db/seed.js'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
