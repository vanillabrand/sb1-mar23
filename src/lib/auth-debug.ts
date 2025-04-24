import { supabase } from './supabase';
import { logService } from './log-service';

/**
 * Debug function to check authentication status
 * Call this when you're experiencing 406 errors
 */
export async function checkAuthStatus() {
  try {
    // Check session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logService.log('error', 'Session error', sessionError, 'AuthDebug');
      console.error('Session error:', sessionError);
      return { authenticated: false, error: sessionError };
    }
    
    if (!sessionData.session) {
      logService.log('warn', 'No active session found', null, 'AuthDebug');
      console.warn('No active session found');
      return { authenticated: false, error: 'No active session' };
    }
    
    // Check user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      logService.log('error', 'User error', userError, 'AuthDebug');
      console.error('User error:', userError);
      return { authenticated: false, error: userError };
    }
    
    if (!userData.user) {
      logService.log('warn', 'No user found', null, 'AuthDebug');
      console.warn('No user found');
      return { authenticated: false, error: 'No user found' };
    }
    
    // Log success
    logService.log('info', 'Authentication successful', {
      userId: userData.user.id,
      email: userData.user.email,
      sessionExpires: sessionData.session?.expires_at
    }, 'AuthDebug');
    
    console.log('Authentication successful:', {
      userId: userData.user.id,
      email: userData.user.email,
      sessionExpires: new Date(sessionData.session?.expires_at * 1000).toLocaleString()
    });
    
    return { 
      authenticated: true, 
      user: userData.user,
      session: sessionData.session
    };
  } catch (error) {
    logService.log('error', 'Authentication check failed', error, 'AuthDebug');
    console.error('Authentication check failed:', error);
    return { authenticated: false, error };
  }
}

/**
 * Debug function to test a specific table access
 * @param tableName The table to test access to
 */
export async function testTableAccess(tableName: string) {
  try {
    // First check auth status
    const authStatus = await checkAuthStatus();
    
    if (!authStatus.authenticated) {
      console.error('Cannot test table access: Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }
    
    // Try to access the table
    console.log(`Testing access to ${tableName} table...`);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      logService.log('error', `Failed to access ${tableName} table`, error, 'AuthDebug');
      console.error(`Failed to access ${tableName} table:`, error);
      return { success: false, error };
    }
    
    logService.log('info', `Successfully accessed ${tableName} table`, { rowCount: data?.length }, 'AuthDebug');
    console.log(`Successfully accessed ${tableName} table. Rows returned: ${data?.length}`);
    return { success: true, data };
  } catch (error) {
    logService.log('error', `Table access test failed for ${tableName}`, error, 'AuthDebug');
    console.error(`Table access test failed for ${tableName}:`, error);
    return { success: false, error };
  }
}
