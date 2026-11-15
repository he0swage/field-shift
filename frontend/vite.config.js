import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build working from any sub-path (e.g. GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // npm run dev: /api calls are forwarded to the backend, so there is no CORS to configure
    proxy: { '/api': { target: 'http://localhost:5001', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:5001', changeOrigin: true } },
  },
});
