// Types for the environment variables the frontend reads at build time.
// See frontend/README.md for what each one does.

interface ImportMetaEnv {
  /** Base URL of the central API, for example http://localhost:8000. */
  readonly VITE_API_BASE_URL?: string;
  /**
   * Path of the TickerLens server's relay to chatgpt.com/backend-api/codex,
   * for example /ai-proxy/codex. Without it, signing in with a ChatGPT plan
   * is unavailable (the dev server always has the relay).
   */
  readonly VITE_CODEX_RELAY_URL?: string;
}
