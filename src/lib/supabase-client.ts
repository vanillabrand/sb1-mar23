import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logService } from './log-service';
import type { Database } from '../types/supabase';

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient<Database> | null = null;
  private connectionTimeout: number = 10000;

  private constructor() {}

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  async getClient(): Promise<SupabaseClient<Database>> {
    if (!this.client) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
      }

      try {
        this.client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
          },
          global: {
            headers: { 'x-client-info': 'supabase-js/2.x' },
          },
        });

        // Verify connection
        await Promise.race([
          this.client.from('health_check').select('count').single(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Supabase connection timeout')), 
            this.connectionTimeout)
          )
        ]);

      } catch (error) {
        logService.log('error', 'Failed to initialize Supabase client', error, 'SupabaseService');
        throw new Error(`Supabase initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return this.client;
  }

  async resetClient(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut();
      this.client = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const { error } = await client.from('health_check').select('count').single();
      return !error;
    } catch (error) {
      logService.log('error', 'Supabase health check failed', error, 'SupabaseService');
      return false;
    }
  }
}

export const supabase = SupabaseService.getInstance().getClient();

export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};
