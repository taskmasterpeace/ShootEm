import { defineConfig } from 'vitest/config'; // vite's defineConfig + the `test` key
import { resolve } from 'node:path';

export default defineConfig({
  // vitest: only the repo's own suite — agent worktrees under .claude/ carry
  // their own copies of the tests and must not pollute the gate counts
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '.claude/**'],
  },
  server: {
    port: 3400,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        // the game
        main: resolve(__dirname, 'index.html'),
        // the model / physics / combat debug harness (dev tool, /harness.html)
        harness: resolve(__dirname, 'harness.html'),
        // §11.5 the War Room — the operator's console (/warroom.html)
        warroom: resolve(__dirname, 'warroom.html'),
      },
    },
  },
});
