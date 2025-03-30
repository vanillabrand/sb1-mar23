/**
 * @deprecated This file is deprecated. Please use './supabase.ts' instead.
 * Having multiple Supabase client instances can cause authentication issues.
 */

import { supabase, getCurrentSession, getCurrentUser } from './supabase';

// Re-export from the consolidated supabase.ts file
export { supabase, getCurrentSession, getCurrentUser };
