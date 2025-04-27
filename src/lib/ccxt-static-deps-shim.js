/**
 * This file provides browser-compatible shims for CCXT static dependencies
 * that are causing import issues in the browser environment.
 */

// Import our qs shim
import qs from './qs-browser-shim.js';

// Re-export for CCXT to use
export { qs };
export { default as qs_default } from './qs-browser-shim.js';

// Mock implementations for other problematic dependencies
export const encode = (str) => {
  if (typeof str !== 'string') return '';
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/g, ',')
    .replace(/%3B/g, ';')
    .replace(/%2B/g, '+')
    .replace(/%3D/g, '=')
    .replace(/%3F/g, '?')
    .replace(/%40/g, '@');
};

export const decode = (str) => {
  if (typeof str !== 'string') return '';
  return decodeURIComponent(str.replace(/\+/g, ' '));
};

// Default export
export default {
  encode,
  decode,
  qs
};
