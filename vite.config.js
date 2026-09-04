import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',

  // Relative asset URLs, so the build works both at a domain root and inside a
  // subdirectory (public_html/dld/...) without being rebuilt for each.
  base: './',

  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5174,
    // The datasets live in /data at the repo root, outside Vite's `client` root.
    // Dev needs explicit permission to read across that boundary; the build does
    // not, since Rollup resolves the import at bundle time.
    fs: { allow: ['..'] },
  },

  build: {
    // Resolved against `root` (client/), so the build always lands in <repo>/dist
    // regardless of which directory `vite build` was invoked from.
    outDir: '../dist',
    emptyOutDir: true,
  },
});
