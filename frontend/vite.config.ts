import react from '@vitejs/plugin-react';
import type {Plugin} from 'vite';
import {defineConfig} from 'vitest/config';

/**
 * Hosts the browser may send data to. Users' API keys go only to the AI
 * provider they picked, so the page is not allowed to connect anywhere else.
 * Add the central API's origin here when it exists.
 */
const CONNECT_SOURCES = [
  "'self'",
  'https://api.anthropic.com',
  'https://api.openai.com',
];

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
