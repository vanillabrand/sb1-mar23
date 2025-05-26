/**
 * Emergency Strategy Fix
 * Immediate fixes for strategy loading and activation issues
 */

import { supabase } from './supabase';
import { logService } from './log-service';
import { strategySync } from './strategy-sync';

export class StrategyEmergencyFix {
  static async runEmergencyFix(): Promise<void> {
    console.log('🚨 Running emergency strategy fix...');
    
    try {
      // 1. Clear all cached data that might be corrupted
      console.log('🧹 Clearing cached data...');
      localStorage.removeItem('strategy-error-cache');
      localStorage.removeItem('strategy-sync-error');
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // 2. Force refresh authentication session
      console.log('🔐 Refreshing authentication...');
      try {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('Session refresh failed:', refreshError);
          // Try to get a new session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.error('No valid session found - user needs to log in again');
            return;
          }
        }
        console.log('✅ Authentication refreshed');
      } catch (authError) {
        console.error('Authentication fix failed:', authError);
        return;
      }
      
      // 3. Test database connection
      console.log('🗄️ Testing database connection...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from('strategies')
            .select('id, name, status, user_id')
            .eq('user_id', session.user.id)
            .limit(1);
          
          if (error) {
            console.error('Database test failed:', error);
            if (error.code === '42501') {
              console.error('RLS policy blocking access - this needs manual database fix');
            }
          } else {
            console.log('✅ Database connection verified');
          }
        }
      } catch (dbError) {
        console.error('Database test error:', dbError);
      }
      
      // 4. Reinitialize strategy sync service
      console.log('🔄 Reinitializing strategy sync...');
      try {
        // Force clear the strategy sync state
        if (strategySync['strategies']) {
          strategySync['strategies'].clear();
        }
        if (strategySync['initialized']) {
          strategySync['initialized'] = false;
        }
        
        // Reinitialize
        await strategySync.initialize();
        console.log('✅ Strategy sync reinitialized');
        
        // Test getting strategies
        const strategies = strategySync.getAllStrategies();
        console.log(`✅ Found ${strategies.length} strategies in cache`);
      } catch (syncError) {
        console.error('Strategy sync fix failed:', syncError);
      }
      
      // 5. Clear browser cache
      console.log('🧹 Clearing browser cache...');
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('✅ Browser cache cleared');
        } catch (cacheError) {
          console.warn('Cache clear failed:', cacheError);
        }
      }
      
      // 6. Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        try {
          (window as any).gc();
          console.log('✅ Garbage collection triggered');
        } catch (gcError) {
          console.warn('GC failed:', gcError);
        }
      }
      
      console.log('✅ Emergency fix completed - reloading page...');
      
      // 7. Force page reload to apply all fixes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Emergency fix failed:', error);
      logService.log('error', 'Emergency strategy fix failed', error, 'StrategyEmergencyFix');
    }
  }
  
  static async quickAuthFix(): Promise<boolean> {
    try {
      console.log('🔐 Running quick auth fix...');
      
      // Clear auth cache
      localStorage.removeItem('supabase.auth.token');
      
      // Refresh session
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Auth refresh failed:', error);
        return false;
      }
      
      // Verify session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('No valid session after refresh');
        return false;
      }
      
      console.log('✅ Auth fix successful');
      return true;
    } catch (error) {
      console.error('Auth fix failed:', error);
      return false;
    }
  }
  
  static async quickDatabaseFix(): Promise<boolean> {
    try {
      console.log('🗄️ Running quick database fix...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('No authenticated user for database fix');
        return false;
      }
      
      // Test basic database access
      const { data, error } = await supabase
        .from('strategies')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Database access failed:', error);
        return false;
      }
      
      console.log('✅ Database fix successful');
      return true;
    } catch (error) {
      console.error('Database fix failed:', error);
      return false;
    }
  }
  
  static async quickStrategySyncFix(): Promise<boolean> {
    try {
      console.log('🔄 Running quick strategy sync fix...');
      
      // Force reinitialize
      await strategySync.initialize();
      
      // Test getting strategies
      const strategies = strategySync.getAllStrategies();
      console.log(`Found ${strategies.length} strategies after sync fix`);
      
      console.log('✅ Strategy sync fix successful');
      return true;
    } catch (error) {
      console.error('Strategy sync fix failed:', error);
      return false;
    }
  }
}

// Make available globally for immediate use
(window as any).StrategyEmergencyFix = StrategyEmergencyFix;

// Auto-run if there are obvious issues
setTimeout(async () => {
  try {
    // Check if there are obvious issues
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('⚠️ No authenticated user detected');
      return;
    }
    
    // Check if strategy sync is working
    const syncStatus = strategySync.getStatus();
    if (!syncStatus.initialized || syncStatus.hasError) {
      console.warn('⚠️ Strategy sync issues detected');
      console.log('💡 Run StrategyEmergencyFix.runEmergencyFix() in console to fix');
    }
    
    // Check if strategies can be loaded
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('count')
        .limit(1);
      
      if (error) {
        console.warn('⚠️ Database access issues detected:', error.message);
        console.log('💡 Run StrategyEmergencyFix.runEmergencyFix() in console to fix');
      }
    } catch (dbError) {
      console.warn('⚠️ Database connection issues detected');
      console.log('💡 Run StrategyEmergencyFix.runEmergencyFix() in console to fix');
    }
    
  } catch (error) {
    console.error('Auto-check failed:', error);
  }
}, 5000);
