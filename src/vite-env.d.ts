/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_SUPABASE_URL_LIGHT?: string;
  readonly VITE_SUPABASE_KEY_LIGHT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __LIGHTHOUSE_CONFIG__?: {
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
    GOOGLE_API_KEY?: string;
    CONFIG_ERROR?: string;
  };
}
