/**
 * This is a simplified browser-compatible version of the 'qs' library
 * that provides basic URL query string parsing and stringifying functionality.
 */

// Simple implementation of query string parsing
export function parse(str, options) {
  if (!str || typeof str !== 'string') {
    return {};
  }

  // Remove leading ? if present
  const queryString = str.charAt(0) === '?' ? str.substring(1) : str;
  
  const obj = {};
  const pairs = queryString.split('&');
  
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    const key = decodeURIComponent(pair[0]);
    
    // Skip empty keys
    if (!key) continue;
    
    let value = pair.length > 1 ? decodeURIComponent(pair[1]) : '';
    
    // Handle array notation like foo[]=1&foo[]=2
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!obj[arrayKey]) {
        obj[arrayKey] = [];
      }
      obj[arrayKey].push(value);
    } else {
      obj[key] = value;
    }
  }
  
  return obj;
}

// Simple implementation of query string stringifying
export function stringify(obj, options) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  
  const parts = [];
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          parts.push(encodeURIComponent(key) + '[]=' + encodeURIComponent(value[i]));
        }
      } else if (value !== undefined && value !== null) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      }
    }
  }
  
  return parts.join('&');
}

// Default export for compatibility
const qs = {
  parse,
  stringify
};

export default qs;
