import { createClient } from '@supabase/supabase-js';

// Use environment variables directly
const supabaseUrl = 'https://gsuiserbzoebcdptglzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdWlzZXJiem9lYmNkcHRnbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0MjE1MzgsImV4cCI6MjA1ODk5NzUzOH0.kSsWOfPW7RI3IXbCUzXi9oKK0zSC__-6p6ukfDJbk-k';

console.log('Creating test Supabase client with:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length
});

// Create a test Supabase client
const supabase = createClient(
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

// Test sign in
async function testSignIn() {
  try {
    console.log('Testing sign in...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password123'
    });
    
    console.log('Sign in result:', { data, error });
    return { data, error };
  } catch (err) {
    console.error('Error during sign in test:', err);
    return { data: null, error: err };
  }
}

// Export for use in browser console
window.testSupabase = {
  supabase,
  testSignIn
};

console.log('Test Supabase client created and exposed as window.testSupabase');
