/**
 * Strategy Diagnostics - Quick diagnosis and fix for strategy issues
 */

import { supabase } from './supabase';
import { logService } from './log-service';
import { strategySync } from './strategy-sync';
import { apiClient } from './api-client';

export interface DiagnosticResult {
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  fix?: () => Promise<void>;
}

export class StrategyDiagnostics {
  static async runQuickDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    console.log('🔍 Running strategy diagnostics...');

    // 1. Check Authentication
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        results.push({
          component: 'Authentication',
          status: 'error',
          message: `Session error: ${error.message}`,
          details: error,
          fix: async () => {
            await supabase.auth.refreshSession();
            console.log('✅ Session refreshed');
          }
        });
      } else if (!session?.user) {
        results.push({
          component: 'Authentication',
          status: 'error',
          message: 'No authenticated user found',
          details: { hasSession: !!session, hasUser: !!session?.user }
        });
      } else {
        results.push({
          component: 'Authentication',
          status: 'success',
          message: `Authenticated as ${session.user.email}`,
          details: { userId: session.user.id, email: session.user.email }
        });
      }
    } catch (error) {
      results.push({
        component: 'Authentication',
        status: 'error',
        message: `Auth check failed: ${error.message}`,
        details: error
      });
    }

    // 2. Check Database Access
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('strategies')
          .select('id, user_id, status, name')
          .eq('user_id', session.user.id)
          .limit(5);

        if (error) {
          results.push({
            component: 'Database Access',
            status: 'error',
            message: `Database error: ${error.message}`,
            details: error,
            fix: async () => {
              // Try to refresh session and retry
              await supabase.auth.refreshSession();
              console.log('✅ Session refreshed for database access');
            }
          });
        } else {
          results.push({
            component: 'Database Access',
            status: 'success',
            message: `Found ${data?.length || 0} strategies in database`,
            details: { strategiesCount: data?.length || 0, strategies: data }
          });
        }
      }
    } catch (error) {
      results.push({
        component: 'Database Access',
        status: 'error',
        message: `Database access failed: ${error.message}`,
        details: error
      });
    }

    // 3. Check Strategy Sync Service
    try {
      const syncStatus = strategySync.getStatus();
      
      if (!syncStatus.initialized) {
        results.push({
          component: 'Strategy Sync',
          status: 'error',
          message: 'Strategy sync not initialized',
          details: syncStatus,
          fix: async () => {
            await strategySync.initialize();
            console.log('✅ Strategy sync reinitialized');
          }
        });
      } else if (syncStatus.hasError) {
        results.push({
          component: 'Strategy Sync',
          status: 'error',
          message: `Sync error: ${syncStatus.errorMessage}`,
          details: syncStatus,
          fix: async () => {
            await strategySync.initialize();
            console.log('✅ Strategy sync reinitialized after error');
          }
        });
      } else {
        const strategies = strategySync.getAllStrategies();
        results.push({
          component: 'Strategy Sync',
          status: 'success',
          message: `Sync working - ${strategies.length} strategies cached`,
          details: { ...syncStatus, strategiesInCache: strategies.length }
        });
      }
    } catch (error) {
      results.push({
        component: 'Strategy Sync',
        status: 'error',
        message: `Strategy sync check failed: ${error.message}`,
        details: error
      });
    }

    // 4. Check API Connectivity
    try {
      const response = await fetch('http://localhost:8080/health');
      if (response.ok) {
        results.push({
          component: 'Rust API',
          status: 'success',
          message: 'Rust API responding',
          details: { status: response.status }
        });
      } else {
        results.push({
          component: 'Rust API',
          status: 'warning',
          message: `API returned ${response.status}`,
          details: { status: response.status }
        });
      }
    } catch (error) {
      results.push({
        component: 'Rust API',
        status: 'warning',
        message: 'API not available - using Supabase fallback',
        details: { error: error.message }
      });
    }

    // 5. Test Strategy Creation
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const testStrategy = {
          id: `test-${Date.now()}`,
          name: 'Diagnostic Test Strategy',
          description: 'Test strategy for diagnostics',
          user_id: session.user.id,
          status: 'inactive',
          risk_level: 'low',
          market_type: 'spot',
          selected_pairs: ['BTC/USDT'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          type: 'custom'
        };

        const { data, error } = await supabase
          .from('strategies')
          .insert(testStrategy)
          .select()
          .single();

        if (error) {
          results.push({
            component: 'Strategy Creation',
            status: 'error',
            message: `Cannot create strategies: ${error.message}`,
            details: error
          });
        } else {
          // Clean up test strategy
          await supabase.from('strategies').delete().eq('id', data.id);
          
          results.push({
            component: 'Strategy Creation',
            status: 'success',
            message: 'Strategy creation test passed',
            details: { testPassed: true }
          });
        }
      }
    } catch (error) {
      results.push({
        component: 'Strategy Creation',
        status: 'error',
        message: `Strategy creation test failed: ${error.message}`,
        details: error
      });
    }

    return results;
  }

  static async applyQuickFixes(results: DiagnosticResult[]): Promise<void> {
    console.log('🔧 Applying quick fixes...');

    for (const result of results) {
      if (result.status === 'error' && result.fix) {
        try {
          await result.fix();
          logService.log('info', `Applied fix for ${result.component}`, null, 'StrategyDiagnostics');
        } catch (error) {
          logService.log('error', `Failed to apply fix for ${result.component}`, error, 'StrategyDiagnostics');
        }
      }
    }

    // Additional general fixes
    try {
      // Clear any cached errors
      localStorage.removeItem('strategy-error-cache');
      localStorage.removeItem('strategy-sync-error');
      
      // Force refresh session
      await supabase.auth.refreshSession();
      
      // Reinitialize strategy sync
      await strategySync.initialize();
      
      console.log('✅ General fixes applied');
    } catch (error) {
      console.error('❌ Failed to apply general fixes:', error);
    }
  }

  static async logCurrentState(): Promise<void> {
    console.log('📊 Current Strategy System State:');
    
    try {
      // Auth state
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email
      });

      // Strategy sync state
      const syncStatus = strategySync.getStatus();
      console.log('Strategy Sync:', syncStatus);

      // Cached strategies
      const strategies = strategySync.getAllStrategies();
      console.log('Cached Strategies:', strategies.length, strategies.map(s => ({ id: s.id, name: s.name, status: s.status })));

      // Database strategies
      if (session?.user) {
        const { data: dbStrategies } = await supabase
          .from('strategies')
          .select('id, name, status, user_id')
          .eq('user_id', session.user.id);
        
        console.log('Database Strategies:', dbStrategies?.length || 0, dbStrategies);
      }

    } catch (error) {
      console.error('Failed to log current state:', error);
    }
  }
}

// Auto-run diagnostics in development
if (import.meta.env.DEV) {
  // Run diagnostics after a short delay to allow app initialization
  setTimeout(async () => {
    try {
      const results = await StrategyDiagnostics.runQuickDiagnostic();
      const hasErrors = results.some(r => r.status === 'error');
      
      if (hasErrors) {
        console.warn('⚠️ Strategy system issues detected:', results.filter(r => r.status === 'error'));
        console.log('💡 Run StrategyDiagnostics.applyQuickFixes() in console to attempt fixes');
      } else {
        console.log('✅ Strategy system appears healthy');
      }
    } catch (error) {
      console.error('Failed to run auto-diagnostics:', error);
    }
  }, 3000);
}

// Make available globally for debugging
(window as any).StrategyDiagnostics = StrategyDiagnostics;
