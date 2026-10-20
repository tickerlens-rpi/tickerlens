// Types for the environment variables the frontend reads at build time.
// See frontend/README.md for what each one does.

interface ImportMetaEnv {
  /** Base URL of the central API, for example http://localhost:8000. */
  readonly VITE_API_BASE_URL?: string;
}
