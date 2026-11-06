/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/*
 * Reading text out of images (OCR) needs three things from tesseract.js: its worker script, its engine
 * (WebAssembly), and the English language data. By default it fetches all three from a CDN. This app
 * runs without accounts or outside services, so we serve them from our own address instead: in
 * development straight out of node_modules, and in a build copied next to the app.
 *
 * Only the engine variants the app uses are included (the "lstm" ones), to keep the build smaller.
 */
function selfHostedOcr(): Plugin {
  const root = path.resolve(import.meta.dirname, '../node_modules');
  const files: Record<string, string> = {
    'ocr/worker.min.js': 'tesseract.js/dist/worker.min.js',
    'ocr/lang/eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    ...Object.fromEntries(['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((n) => [`ocr/core/${n}.wasm.js`, `tesseract.js-core/${n}.wasm.js`])),
  };
  const types: Record<string, string> = { '.js': 'text/javascript', '.gz': 'application/gzip' };
  return {
    name: 'self-hosted-ocr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = req.url?.split('?')[0]?.replace(/^\//, '') ?? '';
        const source = files[key];
        if (!source) return next();
        res.setHeader('Content-Type', types[path.extname(key)] ?? 'application/octet-stream');
        fs.createReadStream(path.join(root, source)).pipe(res);
      });
    },
    generateBundle() {
      for (const [out, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: out, source: fs.readFileSync(path.join(root, source)) });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Read API_PORT from the shared root .env, so client and server agree on one value.
  const env = loadEnv(mode, '..', 'API_');
  const apiPort = env.API_PORT ?? '3001';

  return {
    plugins: [react(), tailwindcss(), selfHostedOcr()],
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
