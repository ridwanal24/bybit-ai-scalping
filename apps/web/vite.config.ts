import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.DASHBOARD_API_URL ?? 'http://127.0.0.1:3000',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
});
