import { defineConfig, loadEnv } from 'vite';

// During `npm run dev` we proxy /api/sheets to the Apps Script Web App so the
// dev experience is same-origin (no CORS) and mirrors the Cloudflare Pages
// Function used in production. Set SHEETS_API_URL in a local .env file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = {};
  if (env.SHEETS_API_URL) {
    proxy['/api/sheets'] = {
      target: env.SHEETS_API_URL,
      changeOrigin: true,
      followRedirects: true,
      rewrite: (path) => path.replace(/^\/api\/sheets/, '')
    };
  }
  return {
    server: { port: 5173, proxy },
    build: { outDir: 'dist', sourcemap: false }
  };
});
