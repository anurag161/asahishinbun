import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the shared workspace to its TypeScript source so tests always
      // run against the latest engine without needing a prior build step.
      '@asahi/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
});
