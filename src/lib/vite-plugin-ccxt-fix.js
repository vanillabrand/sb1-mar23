/**
 * Custom Vite plugin to fix CCXT static dependencies import issues
 */

export default function ccxtFixPlugin() {
  return {
    name: 'vite-plugin-ccxt-fix',
    
    // This transform hook will intercept specific problematic modules
    transform(code, id) {
      // Fix for encode.js trying to import default from qs/index.cjs
      if (id.includes('ccxt/js/src/static_dependencies/qs/lib/encode.js')) {
        // Replace the problematic import with our custom implementation
        return `
          // Custom browser-compatible implementation
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
          export default { encode };
        `;
      }
      
      // Fix for qs/index.cjs
      if (id.includes('ccxt/js/src/static_dependencies/qs/index.cjs')) {
        // Provide a simplified implementation of the qs library
        return `
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
          export { parse, stringify };
        `;
      }
      
      return null; // Return null to use the default transform
    }
  };
}
