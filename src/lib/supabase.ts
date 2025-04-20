import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';
import { config } from './config';

// Use environment variables or config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || config.supabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || config.supabaseAnonKey;

console.log('Supabase initialization:', {
  supabaseUrl,
  anonKeyLength: supabaseAnonKey?.length || 0,
  envVars: {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
    configUrl: config.supabaseUrl ? 'defined' : 'undefined',
    configKey: config.supabaseAnonKey ? 'defined' : 'undefined'
  }
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

// Create a single Supabase client instance for the entire application
console.log('Creating Supabase client with options:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length,
  options: {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
});

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'X-Client-Info': 'supabase-js/2.x'
      }
    },
    db: {
      schema: 'public'
    }
  }
);

console.log('Supabase client created:', supabase);

// Utility function to get the current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

// Utility function to get the current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export { type Database } from './supabase-types';
