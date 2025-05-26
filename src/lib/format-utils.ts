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

/**
 * Formats a number as a currency string
 * @param value Number to format
 * @param currency Currency code (default: USD)
 * @param locale Locale for formatting (default: en-US)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD', locale: string = 'en-US'): string {
  // Handle NaN, undefined, etc.
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }

  // Format with appropriate precision based on value
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  });

  return formatter.format(value);
}

/**
 * Formats a date string or Date object into a readable format
 * @param date Date string or Date object
 * @param format Format type ('short', 'medium', 'long', 'relative')
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, format: 'short' | 'medium' | 'long' | 'relative' = 'medium'): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (format === 'relative') {
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return dateObj.toLocaleDateString();
    }
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'medium':
    default:
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }
}

/**
 * Formats a percentage value
 * @param value Number to format as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats a number with appropriate precision
 * @param value Number to format
 * @param decimals Number of decimal places (default: auto)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals?: number): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  if (decimals !== undefined) {
    return value.toFixed(decimals);
  }

  // Auto-determine decimal places based on value
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  } else if (Math.abs(value) >= 1) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } else if (Math.abs(value) >= 0.01) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  } else {
    return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }
}
