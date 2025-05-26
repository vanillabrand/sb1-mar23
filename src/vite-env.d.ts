/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Core API Keys
  readonly VITE_DEEPSEEK_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ENCRYPTION_KEY: string

  // News API
  readonly VITE_NEWS_API_KEY: string
  readonly VITE_NEWS_API_URL: string

  // Demo Exchange
  readonly VITE_DEMO_EXCHANGE_API_KEY: string
  readonly VITE_DEMO_EXCHANGE_SECRET: string
  readonly VITE_DEMO_EXCHANGE_MEMO: string

  // Binance TestNet
  readonly VITE_BINANCE_TESTNET_API_KEY: string
  readonly VITE_BINANCE_TESTNET_API_SECRET: string
  readonly VITE_BINANCE_FUTURES_TESTNET_API_KEY: string
  readonly VITE_BINANCE_FUTURES_TESTNET_API_SECRET: string

  // Exchange URLs
  readonly VITE_BINANCE_BASE_URL: string
  readonly VITE_BINANCE_TESTNET_BASE_URL: string
  readonly VITE_BINANCE_FUTURES_TESTNET_BASE_URL: string
  readonly VITE_BINANCE_TESTNET_WEBSOCKETS_URL: string

  // Proxy Configuration
  readonly VITE_PROXY_URL: string
  readonly VITE_PROXY_BASE_URL: string

  // Performance Flags
  readonly VITE_FAST_INIT: string
  readonly VITE_LAZY_LOAD_SERVICES: string
  readonly VITE_INITIALIZATION_TIMEOUT: string
  readonly VITE_DEMO_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
