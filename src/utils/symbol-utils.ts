import { logService } from '../lib/log-service';

/**
 * Normalizes a symbol to a consistent format
 * @param symbol Symbol to normalize
 * @returns Normalized symbol in format BASE/QUOTE
 */
export const normalizeSymbol = (symbol: string): string => {
  if (!symbol) {
    logService.log('warn', 'Attempted to normalize undefined or empty symbol', null, 'SymbolUtils');
    return 'BTC/USDT'; // Default fallback
  }
  
  // If symbol contains underscore, replace with slash
  if (symbol.includes('_')) {
    return symbol.replace('_', '/');
  }
  // If symbol doesn't contain slash or underscore, assume it needs USDT pair
  else if (!symbol.includes('/')) {
    return `${symbol}/USDT`;
  }
  // Already in correct format
  return symbol;
};

/**
 * Converts a symbol from slash format to underscore format
 * @param symbol Symbol to convert
 * @returns Symbol with underscores
 */
export const symbolToUnderscore = (symbol: string): string => {
  const normalized = normalizeSymbol(symbol);
  return normalized.replace('/', '_');
};

/**
 * Gets the base asset from a symbol
 * @param symbol Symbol to extract from
 * @returns Base asset
 */
export const getBaseAsset = (symbol: string): string => {
  const normalized = normalizeSymbol(symbol);
  return normalized.split('/')[0];
};

/**
 * Gets the quote asset from a symbol
 * @param symbol Symbol to extract from
 * @returns Quote asset
 */
export const getQuoteAsset = (symbol: string): string => {
  const normalized = normalizeSymbol(symbol);
  const parts = normalized.split('/');
  return parts.length > 1 ? parts[1] : 'USDT';
};

/**
 * Gets a base price for a given symbol
 * @param symbol Trading pair symbol
 * @returns Base price
 */
export const getBasePrice = (symbol: string): number => {
  // Normalize the symbol format
  const baseAsset = getBaseAsset(symbol);

  // Return realistic prices for common cryptocurrencies
  switch (baseAsset.toUpperCase()) {
    case 'BTC': return 50000;
    case 'ETH': return 3000;
    case 'SOL': return 100;
    case 'BNB': return 500;
    case 'XRP': return 0.5;
    case 'ADA': return 0.8;
    case 'DOT': return 20;
    case 'DOGE': return 0.1;
    case 'MATIC': return 1.5;
    case 'LINK': return 15;
    case 'UNI': return 10;
    case 'AVAX': return 30;
    case 'ATOM': return 12;
    case 'LTC': return 200;
    case 'BCH': return 500;
    default: return 100;
  }
};

/**
 * Generates a random price for a symbol based on its base price
 * @param symbol Trading pair symbol
 * @returns Random price
 */
export const generateRandomPrice = (symbol: string): number => {
  const basePrice = getBasePrice(symbol);
  // Generate a price within ±2% of the base price
  const randomFactor = 0.98 + (Math.random() * 0.04);
  return basePrice * randomFactor;
};

/**
 * Generates a random amount based on the symbol's typical trading volume
 * @param symbol Optional trading pair symbol
 * @returns Random amount
 */
export const generateRandomAmount = (symbol?: string): number => {
  if (symbol) {
    const basePrice = getBasePrice(symbol);
    
    // Scale amount inversely with price to get realistic values
    if (basePrice > 10000) { // BTC
      return 0.001 + (Math.random() * 0.009);
    } else if (basePrice > 1000) { // ETH
      return 0.01 + (Math.random() * 0.09);
    } else if (basePrice > 100) { // SOL, etc.
      return 0.1 + (Math.random() * 0.9);
    } else if (basePrice > 10) { // LINK, UNI, etc.
      return 1 + (Math.random() * 9);
    } else if (basePrice > 1) { // ADA, MATIC, etc.
      return 10 + (Math.random() * 90);
    } else { // XRP, DOGE, etc.
      return 100 + (Math.random() * 900);
    }
  }
  
  // Default random amount if no symbol provided
  return 0.1 + (Math.random() * 0.9);
};
