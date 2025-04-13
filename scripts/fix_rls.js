// Script to fix RLS policies
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixRlsPolicies() {
  try {
    console.log('Fixing RLS policies...');

    // Read the SQL file
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/fix_rls_policies.sql'),
      'utf8'
    );

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error executing SQL:', error);
      return;
    }

    console.log('Successfully fixed RLS policies');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
fixRlsPolicies().catch(console.error);
