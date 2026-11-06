import react from '@vitejs/plugin-react';
import type {Plugin} from 'vite';
import {defineConfig} from 'vitest/config';

/**
 * Hosts the browser may send data to. Users' API keys go only to the AI
 * provider they picked, so the page is not allowed to connect anywhere else.
 * The central API (`/api`) and the ChatGPT relay (`/ai-proxy/codex`) are on
 * the site's own origin. auth.openai.com handles signing in with a ChatGPT
 * plan.
 */
const CONNECT_SOURCES = [
  "'self'",
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://auth.openai.com',
];

/**
 * What the ChatGPT relay calls itself to chatgpt.com, as CLIProxyAPI does.
 * Keep in step with the same header in `nginx.conf`.
 */
const CODEX_USER_AGENT =
  'codex-tui/0.154.0 (Mac OS 26.5.2; arm64) iTerm.app/3.6.11 (codex-tui; 0.154.0)';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes inline `style` attributes (for example the sparkline).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src ${CONNECT_SOURCES.join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Adds the Content-Security-Policy to production builds only. The dev server
 * needs inline scripts and a WebSocket for hot reload, which this would block.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'tickerlens-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
        {
          tag: 'meta',
          attrs: {name: 'referrer', content: 'no-referrer'},
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// https://vite.dev/config/ and https://vitest.dev/config/
export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  server: {
    proxy: {
      // The central API, as nginx serves it in the Docker image. Point it
      // elsewhere with TICKERLENS_API_TARGET.
      '/api': {
        target: process.env.TICKERLENS_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
      // The ChatGPT relay, as nginx serves it in the Docker image.
      '/ai-proxy/codex': {
        target: 'https://chatgpt.com',
        changeOrigin: true,
        rewrite: path =>
          path.replace(/^\/ai-proxy\/codex/, '/backend-api/codex'),
        configure: proxy => {
          proxy.on('proxyReq', request => {
            request.removeHeader('origin');
            request.removeHeader('referer');
            request.removeHeader('cookie');
            request.setHeader('user-agent', CODEX_USER_AGENT);
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
});
