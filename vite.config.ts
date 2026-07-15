import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
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
      },
    },
  },
});
