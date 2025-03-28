import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { config } from '../config';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || config.supabaseUrl;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || config.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);
