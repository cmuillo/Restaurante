import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/pos/',
  root: 'src/apps/pos',
  build: { outDir: '../../../dist/pos', emptyOutDir: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_TARGET ?? 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
