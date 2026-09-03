import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    outDir: path.resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
  },
});
