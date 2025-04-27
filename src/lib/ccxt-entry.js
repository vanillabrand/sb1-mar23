/**
 * This file serves as the main entry point for CCXT imports
 * It ensures all imports of 'ccxt' are properly redirected to our browser-compatible wrapper
 */

// Import and re-export our browser-compatible wrapper
import ccxtWrapper from './ccxt-browser-wrapper.js';

// Re-export everything from the wrapper
export default ccxtWrapper;

// Also export individual exchange constructors
export const {
  binance,
  bybit,
  bitmart,
  bitget,
  okx,
  coinbase,
  kraken
} = ccxtWrapper;
