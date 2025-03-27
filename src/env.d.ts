/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_DEMO_EXCHANGE_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_SECRET: string
  readonly VITE_DEMO_EXCHANGE_MEMO: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}