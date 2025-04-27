/**
 * This is a specific shim for the encode.js file in CCXT's static dependencies
 * that's causing the "does not provide an export named 'default'" error.
 */

// Simple implementation of URL encoding
export function encode(str) {
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
}

// Default export for compatibility
const encoder = {
  encode
};

export default encoder;
