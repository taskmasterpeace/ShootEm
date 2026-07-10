import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3400,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
