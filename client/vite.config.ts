/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Read API_PORT from the shared root .env, so client and server agree on one value.
  const env = loadEnv(mode, '..', 'API_');
  const apiPort = env.API_PORT ?? '3001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // The browser only ever talks to Vite (same origin), and Vite forwards
      // /api/* to Express. That means no CORS setup, and later the Anthropic API
      // key stays on the server, where the browser can't see it.
      proxy: {
        '/api': `http://127.0.0.1:${apiPort}`,
      },
    },
    test: {
      environment: 'node',
    },
  };
});
