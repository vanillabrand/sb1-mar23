import { createClient } from '@supabase/supabase-js';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config';

const { supabaseUrl, supabaseAnonKey } = config;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Configure proxy agents if needed
const proxyUrl = process.env.PROXY_URL;
const options = proxyUrl
  ? {
      auth: {
        persistSession: false, // Changed to false for backend
      },
      global: {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
        fetch: (url: string, options: RequestInit) => {
          const agent = url.startsWith('https:')
            ? new HttpsProxyAgent(proxyUrl)
            : new HttpProxyAgent(proxyUrl);
          return fetch(url, { ...options, agent });
        },
      },
    }
  : undefined;

// Create Supabase client with proxy support for backend
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, options);
