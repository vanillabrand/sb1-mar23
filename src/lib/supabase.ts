import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';
import { config } from './config';

// Use environment variables or config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || config.supabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || config.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single Supabase client instance for the entire application
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

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
