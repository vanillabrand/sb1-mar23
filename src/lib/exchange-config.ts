import ccxt from 'ccxt';
import type { Exchange } from './types';

export function getExchangeConfigurations(): Exchange[] {
  return Object.entries(ccxt.exchanges).map(([id, ExchangeClass]) => {
    const exchange = new (ExchangeClass as any)();
    return {
      id,
      name: exchange.name || id.toUpperCase(),
      logo: `path/to/exchange/logos/${id}.png`,
      description: `Trade on ${exchange.name || id.toUpperCase()}`,
      features: [
        exchange.has.spot ? 'Spot Trading' : null,
        exchange.has.margin ? 'Margin Trading' : null,
        exchange.has.future ? 'Futures Trading' : null,
        'API Trading'
      ].filter(Boolean),
      fields: [
        {
          name: 'API Key',
          key: 'apiKey',
          required: true,
          type: 'text',
          placeholder: 'Enter your API key',
          description: `Your ${exchange.name || id.toUpperCase()} API key`
        }
      ],
      testnetSupported: Boolean(exchange.urls?.test),
      marginSupported: exchange.has.margin,
      futuresSupported: exchange.has.future,
      spotSupported: exchange.has.spot
    };
  });
}