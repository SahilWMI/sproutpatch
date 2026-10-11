/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODEL?: string;
  readonly VITE_BASE_URL?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_TIMEOUT_MS?: string;
  readonly VITE_DEFAULT_LAT?: string;
  readonly VITE_DEFAULT_LON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
