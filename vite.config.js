import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': 'http://localhost:5061',
    },
  },
  build: {
    // Resolved against `root` (client/), so the build always lands in <repo>/dist
    // regardless of which directory `vite build` was invoked from. Anchoring it
    // to process.cwd() instead put dist wherever the caller happened to be.
    outDir: '../dist',
    emptyOutDir: true,
  },
});
