import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup-e2e.ts'],
    // One shared test database, reseeded before every file (some files write to it):
    // run the files one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
