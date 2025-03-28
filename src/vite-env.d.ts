/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_SECRET: string
  readonly VITE_DEMO_EXCHANGE_MEMO: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PROXY_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
