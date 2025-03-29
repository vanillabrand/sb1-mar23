// Polyfill global Node.js variables and functions
if (typeof global === 'undefined') {
  (window as any).global = window;
}

if (typeof process === 'undefined') {
  (window as any).process = {
    env: {
      NODE_ENV: import.meta.env.MODE,
      NODE_DEBUG: 'false',
    },
    version: '',
    versions: {},
    platform: 'browser',
    nextTick: (fn: Function, ...args: any[]) => {
      Promise.resolve().then(() => fn(...args));
    },
  };
}

// Export common Node.js built-ins
export const Buffer = {
  from: (data: any, encoding?: string) => {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return data;
  },
  isBuffer: (obj: any) => false,
};

export const setImmediate = (fn: Function, ...args: any[]) => {
  return setTimeout(() => fn(...args), 0);
};

export const clearImmediate = (id: number) => {
  clearTimeout(id);
};

// Add these to window for libraries that check for them
(window as any).Buffer = Buffer;
(window as any).setImmediate = setImmediate;
(window as any).clearImmediate = clearImmediate;
