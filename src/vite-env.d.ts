/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Operations console (/console)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Info site (shared names with the phone apps and legal pages)
  readonly EXPO_PUBLIC_SUPPORT_EMAIL?: string;
  readonly EXPO_PUBLIC_LEGAL_NAME?: string;
  readonly EXPO_PUBLIC_APP_STORE_URL?: string;
  readonly EXPO_PUBLIC_PLAY_STORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
