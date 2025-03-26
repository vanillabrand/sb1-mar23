/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_SECRET: string
  readonly VITE_DEMO_EXCHANGE_MEMO: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
