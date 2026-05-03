import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src/popup'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/popup'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'firefox109',
  },
});
