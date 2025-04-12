/**
 * Utility functions for formatting and standardizing data across the application
 */

/**
 * Standardizes asset pair format to BTC/USDT format for display
 * @param symbol Asset pair in any format (BTC/USDT, BTC_USDT, BTCUSDT)
 * @returns Standardized asset pair in BTC/USDT format
 */
export function standardizeAssetPairFormat(symbol: string): string {
  if (!symbol) return '';
  
  // If already in BTC/USDT format, return as is
  if (symbol.includes('/')) return symbol;
  
  // If in BTC_USDT format, replace underscore with slash
  if (symbol.includes('_')) return symbol.replace('_', '/');
  
  // If in BTCUSDT format, find the base and quote currencies
  // Common quote currencies to check for
  const quoteCurrencies = ['USDT', 'BUSD', 'USDC', 'USD', 'BTC', 'ETH'];
  
  for (const quote of quoteCurrencies) {
    if (symbol.endsWith(quote)) {
      const base = symbol.substring(0, symbol.length - quote.length);
      return `${base}/${quote}`;
    }
  }
  
  // If we can't determine the format, make a best guess by assuming
  // the last 4 characters are the quote currency
  if (symbol.length > 4) {
    const base = symbol.substring(0, symbol.length - 4);
    const quote = symbol.substring(symbol.length - 4);
    return `${base}/${quote}`;
  }
  
  // If all else fails, return the original
  return symbol;
}

/**
 * Converts asset pair to BitMart format (BTC_USDT)
 * @param symbol Asset pair in any format
 * @returns Asset pair in BitMart format (BTC_USDT)
 */
export function toBitmartFormat(symbol: string): string {
  if (!symbol) return '';
  
  // If already in BTC_USDT format, return as is
  if (symbol.includes('_')) return symbol;
  
  // If in BTC/USDT format, replace slash with underscore
  if (symbol.includes('/')) return symbol.replace('/', '_');
  
  // If in BTCUSDT format, find the base and quote currencies
  // Common quote currencies to check for
  const quoteCurrencies = ['USDT', 'BUSD', 'USDC', 'USD', 'BTC', 'ETH'];
  
  for (const quote of quoteCurrencies) {
    if (symbol.endsWith(quote)) {
      const base = symbol.substring(0, symbol.length - quote.length);
      return `${base}_${quote}`;
    }
  }
  
  // If we can't determine the format, make a best guess by assuming
  // the last 4 characters are the quote currency
  if (symbol.length > 4) {
    const base = symbol.substring(0, symbol.length - 4);
    const quote = symbol.substring(symbol.length - 4);
    return `${base}_${quote}`;
  }
  
  // If all else fails, return the original
  return symbol;
}

/**
 * Converts asset pair to Binance WebSocket format (btcusdt@trade)
 * @param symbol Asset pair in any format
 * @returns Asset pair in Binance WebSocket format (btcusdt@trade)
 */
export function toBinanceWsFormat(symbol: string, suffix: string = '@trade'): string {
  if (!symbol) return '';
  
  // Remove any separators and convert to lowercase
  let formatted = symbol.replace(/[/_]/g, '').toLowerCase();
  
  // Add the suffix if it doesn't already have it
  if (!formatted.includes('@') && suffix) {
    formatted += suffix;
  }
  
  return formatted;
}

/**
 * Gets the base price for a symbol for demo mode
 * @param symbol Asset pair in any format
 * @returns Base price for the symbol
 */
export function getBasePrice(symbol: string): number {
  const standardized = standardizeAssetPairFormat(symbol);
  
  // Extract the base currency
  const baseCurrency = standardized.split('/')[0];
  
  // Return a realistic base price based on the currency
  switch (baseCurrency.toUpperCase()) {
    case 'BTC': return 50000 + (Math.random() * 5000);
    case 'ETH': return 3000 + (Math.random() * 300);
    case 'SOL': return 100 + (Math.random() * 10);
    case 'BNB': return 400 + (Math.random() * 40);
    case 'XRP': return 0.5 + (Math.random() * 0.05);
    case 'ADA': return 0.4 + (Math.random() * 0.04);
    case 'DOT': return 6 + (Math.random() * 0.6);
    case 'DOGE': return 0.08 + (Math.random() * 0.008);
    case 'AVAX': return 30 + (Math.random() * 3);
    case 'MATIC': return 0.8 + (Math.random() * 0.08);
    case 'LINK': return 15 + (Math.random() * 1.5);
    case 'UNI': return 5 + (Math.random() * 0.5);
    case 'ATOM': return 10 + (Math.random() * 1);
    case 'LTC': return 80 + (Math.random() * 8);
    case 'BCH': return 250 + (Math.random() * 25);
    case 'XLM': return 0.1 + (Math.random() * 0.01);
    case 'EOS': return 0.7 + (Math.random() * 0.07);
    case 'TRX': return 0.08 + (Math.random() * 0.008);
    case 'XTZ': return 0.9 + (Math.random() * 0.09);
    case 'ALGO': return 0.15 + (Math.random() * 0.015);
    default: return 10 + (Math.random() * 1); // Default price for unknown assets
  }
}
