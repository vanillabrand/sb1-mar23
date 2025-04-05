/**
 * @deprecated This file is deprecated. Please use './supabase.ts' instead.
 * Having multiple Supabase client instances can cause authentication issues.
 */

// Import and re-export from the canonical supabase.ts file
import { supabase, getCurrentSession, getCurrentUser } from './supabase';
export { supabase, getCurrentSession, getCurrentUser };

// Log a warning when this file is imported
console.warn(
  'Warning: You are importing from the deprecated supabase-client.ts file. ' +
  'Please update your imports to use supabase.ts instead to avoid authentication issues.'
);

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