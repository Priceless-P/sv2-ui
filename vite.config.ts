import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Output the static frontend bundle served by nginx in production.
    outDir: 'dist',
    // Generate source maps for debugging
    sourcemap: true,
    // Ensure clean builds
    emptyOutDir: true,
  },
});
