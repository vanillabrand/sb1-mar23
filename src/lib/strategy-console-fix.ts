/**
 * Strategy Console Fix
 * Simple console commands to fix strategy issues
 */

import { supabase } from './supabase';
import { strategySync } from './strategy-sync';

// Make these functions available globally for console use
declare global {
  interface Window {
    fixStrategies: () => Promise<void>;
    checkStrategies: () => Promise<void>;
    clearStrategyCache: () => void;
    refreshAuth: () => Promise<void>;
  }
}

// Fix strategy issues
window.fixStrategies = async () => {
  console.log('🔧 Starting strategy fix...');
  
  try {
    // 1. Clear cached data
    console.log('🧹 Clearing cached data...');
    localStorage.removeItem('strategy-error-cache');
    localStorage.removeItem('strategy-sync-error');
    localStorage.removeItem('supabase.auth.token');
    
    // 2. Refresh authentication
    console.log('🔐 Refreshing authentication...');
    const { error: authError } = await supabase.auth.refreshSession();
    if (authError) {
      console.error('❌ Auth refresh failed:', authError);
    } else {
      console.log('✅ Authentication refreshed');
    }
    
    // 3. Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error('❌ No valid session found. Please log in again.');
      return;
    }
    console.log('✅ Valid session found for:', session.user.email);
    
    // 4. Test database access
    console.log('🗄️ Testing database access...');
    const { data: testData, error: dbError } = await supabase
      .from('strategies')
      .select('id, name, status')
      .eq('user_id', session.user.id)
      .limit(5);
    
    if (dbError) {
      console.error('❌ Database access failed:', dbError);
      if (dbError.code === '42501') {
        console.error('🚫 RLS policy blocking access - contact support');
      }
    } else {
      console.log('✅ Database access working. Found', testData?.length || 0, 'strategies');
    }
    
    // 5. Reinitialize strategy sync
    console.log('🔄 Reinitializing strategy sync...');
    try {
      await strategySync.initialize();
      const strategies = strategySync.getAllStrategies();
      console.log('✅ Strategy sync reinitialized. Cached strategies:', strategies.length);
    } catch (syncError) {
      console.error('❌ Strategy sync failed:', syncError);
    }
    
    // 6. Test strategy creation
    console.log('🧪 Testing strategy creation...');
    const testStrategy = {
      id: `test-fix-${Date.now()}`,
      name: 'Test Strategy Fix',
      description: 'Test strategy for fix verification',
      user_id: session.user.id,
      status: 'inactive',
      risk_level: 'low',
      market_type: 'spot',
      selected_pairs: ['BTC/USDT'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: 'custom'
    };
    
    const { data: createdStrategy, error: createError } = await supabase
      .from('strategies')
      .insert(testStrategy)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Strategy creation failed:', createError);
    } else {
      console.log('✅ Strategy creation test passed');
      // Clean up test strategy
      await supabase.from('strategies').delete().eq('id', createdStrategy.id);
      console.log('✅ Test strategy cleaned up');
    }
    
    console.log('🎉 Strategy fix completed! Try refreshing the page.');
    
  } catch (error) {
    console.error('❌ Strategy fix failed:', error);
  }
};

// Check strategy system status
window.checkStrategies = async () => {
  console.log('🔍 Checking strategy system status...');
  
  try {
    // Check auth
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Auth Status:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      email: session?.user?.email
    });
    
    if (!session?.user) {
      console.warn('⚠️ No authenticated user');
      return;
    }
    
    // Check database
    const { data: dbStrategies, error: dbError } = await supabase
      .from('strategies')
      .select('id, name, status, user_id')
      .eq('user_id', session.user.id);
    
    console.log('Database Status:', {
      error: dbError?.message || null,
      strategiesCount: dbStrategies?.length || 0,
      strategies: dbStrategies?.map(s => ({ id: s.id, name: s.name, status: s.status })) || []
    });
    
    // Check strategy sync
    const syncStatus = strategySync.getStatus();
    const cachedStrategies = strategySync.getAllStrategies();
    console.log('Strategy Sync Status:', {
      ...syncStatus,
      cachedCount: cachedStrategies.length,
      cached: cachedStrategies.map(s => ({ id: s.id, name: s.name, status: s.status }))
    });
    
    // Check API
    try {
      const apiResponse = await fetch('http://localhost:8080/health');
      console.log('Rust API Status:', {
        available: apiResponse.ok,
        status: apiResponse.status
      });
    } catch (apiError) {
      console.log('Rust API Status:', {
        available: false,
        error: 'Not available - using Supabase fallback'
      });
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
};

// Clear strategy cache
window.clearStrategyCache = () => {
  console.log('🧹 Clearing strategy cache...');
  localStorage.removeItem('strategy-error-cache');
  localStorage.removeItem('strategy-sync-error');
  localStorage.removeItem('supabase.auth.token');
  sessionStorage.clear();
  console.log('✅ Cache cleared');
};

// Refresh authentication
window.refreshAuth = async () => {
  console.log('🔐 Refreshing authentication...');
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('❌ Auth refresh failed:', error);
    } else {
      console.log('✅ Authentication refreshed');
    }
  } catch (error) {
    console.error('❌ Auth refresh error:', error);
  }
};

// Auto-run status check in development
if (import.meta.env.DEV) {
  setTimeout(() => {
    console.log('🔧 Strategy Console Fix loaded. Available commands:');
    console.log('  fixStrategies() - Fix strategy loading and activation issues');
    console.log('  checkStrategies() - Check current strategy system status');
    console.log('  clearStrategyCache() - Clear all cached strategy data');
    console.log('  refreshAuth() - Refresh authentication session');
  }, 2000);
}
