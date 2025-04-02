/**
 * @deprecated This file is deprecated. Please use './supabase.ts' instead.
 * Having multiple Supabase client instances can cause authentication issues.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single client instance with proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'trading-strategy-app'
    }
  }
});

// Add error handling for database operations
export async function executeWithErrorHandling<T>(
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await operation();
  
  if (error) {
    console.error('Supabase operation failed:', error);
    throw new Error(error.message || 'Database operation failed');
  }
  
  if (data === null) {
    throw new Error('No data returned from operation');
  }
  
  return data as T;
}

// Export a typed version of the client
export type SupabaseClient = typeof supabase;