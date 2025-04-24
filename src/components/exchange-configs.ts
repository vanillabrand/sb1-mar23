// Define exchange-specific field configurations
export interface ExchangeField {
  name: string;
  key: string;
  required: boolean;
  type: 'text' | 'password';
  placeholder: string;
  description: string;
}

export interface ExchangeInfo {
  name: string;
  fields: ExchangeField[];
  description: string;
  testnetSupported: boolean;
  testnetUrl?: string;
  apiDocUrl?: string;
}

// Exchange-specific configurations
export const exchangeConfigs: Record<string, ExchangeInfo> = {
  binance: {
    name: 'Binance',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your Binance API key',
        description: 'Your Binance API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your Binance API secret',
        description: 'Your Binance API secret from the API Management section'
      }
    ],
    description: 'Connect to Binance for spot, margin, and futures trading.',
    testnetSupported: true,
    testnetUrl: 'https://testnet.binance.vision/',
    apiDocUrl: 'https://binance-docs.github.io/apidocs/'
  },
  bybit: {
    name: 'Bybit',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your Bybit API key',
        description: 'Your Bybit API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your Bybit API secret',
        description: 'Your Bybit API secret from the API Management section'
      }
    ],
    description: 'Connect to Bybit for spot, margin, and futures trading.',
    testnetSupported: true,
    testnetUrl: 'https://testnet.bybit.com/',
    apiDocUrl: 'https://bybit-exchange.github.io/docs/'
  },
  okx: {
    name: 'OKX',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your OKX API key',
        description: 'Your OKX API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your OKX API secret',
        description: 'Your OKX API secret from the API Management section'
      },
      {
        name: 'Passphrase',
        key: 'memo',
        required: true,
        type: 'password',
        placeholder: 'Enter your OKX API passphrase',
        description: 'Your OKX API passphrase (required for authentication)'
      }
    ],
    description: 'Connect to OKX for spot, margin, and futures trading.',
    testnetSupported: true,
    testnetUrl: 'https://www.okx.com/testnet',
    apiDocUrl: 'https://www.okx.com/docs-v5/'
  },
  bitmart: {
    name: 'BitMart',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your BitMart API key',
        description: 'Your BitMart API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your BitMart API secret',
        description: 'Your BitMart API secret from the API Management section'
      },
      {
        name: 'Memo',
        key: 'memo',
        required: false,
        type: 'text',
        placeholder: 'Enter your BitMart memo (if required)',
        description: 'Optional memo for BitMart API'
      }
    ],
    description: 'Connect to BitMart for spot trading.',
    testnetSupported: false
  },
  bitget: {
    name: 'Bitget',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your Bitget API key',
        description: 'Your Bitget API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your Bitget API secret',
        description: 'Your Bitget API secret from the API Management section'
      },
      {
        name: 'Passphrase',
        key: 'memo',
        required: true,
        type: 'password',
        placeholder: 'Enter your Bitget passphrase',
        description: 'Your Bitget API passphrase (required for authentication)'
      }
    ],
    description: 'Connect to Bitget for spot, margin, and futures trading.',
    testnetSupported: false
  },
  coinbase: {
    name: 'Coinbase',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your Coinbase API key',
        description: 'Your Coinbase API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your Coinbase API secret',
        description: 'Your Coinbase API secret from the API Management section'
      }
    ],
    description: 'Connect to Coinbase for spot trading.',
    testnetSupported: false
  },
  kraken: {
    name: 'Kraken',
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your Kraken API key',
        description: 'Your Kraken API key from the API Management section'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your Kraken API secret',
        description: 'Your Kraken API secret from the API Management section'
      }
    ],
    description: 'Connect to Kraken for spot and futures trading.',
    testnetSupported: false
  }
};
