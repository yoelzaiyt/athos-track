/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GT06_HOST?: string;
  readonly VITE_GT06_TCP_PORT?: string;
  readonly VITE_GT06_TRANSPORT?: string;
  readonly VITE_ATHOS_ENV_LABEL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_ROUTING_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
