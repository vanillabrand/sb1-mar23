/**
 * Strategy Debug Service
 * Comprehensive debugging for strategy loading and activation issues
 */

import { supabase } from './supabase';
import { logService } from './log-service';
import { strategySync } from './strategy-sync';
import { apiClient } from './api-client';
import { demoService } from './demo-service';

export interface StrategyDebugResult {
  success: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  data: Record<string, any>;
}

export class StrategyDebugService {
  /**
   * Comprehensive strategy system diagnosis
   */
  static async diagnoseStrategyIssues(): Promise<StrategyDebugResult> {
    const result: StrategyDebugResult = {
      success: true,
      issues: [],
      warnings: [],
      recommendations: [],
      data: {}
    };

    console.log('🔍 Starting strategy system diagnosis...');

    // 1. Check Authentication
    await this.checkAuthentication(result);

    // 2. Check Database Connection
    await this.checkDatabaseConnection(result);

    // 3. Check RLS Policies
    await this.checkRLSPolicies(result);

    // 4. Check API Connectivity
    await this.checkAPIConnectivity(result);

    // 5. Check Strategy Sync Service
    await this.checkStrategySyncService(result);

    // 6. Check Demo Mode
    await this.checkDemoMode(result);

    // 7. Test Strategy Operations
    await this.testStrategyOperations(result);

    // Determine overall success
    result.success = result.issues.length === 0;

    // Log results
    if (result.success) {
      logService.log('info', 'Strategy system diagnosis completed successfully', result, 'StrategyDebug');
      console.log('✅ Strategy system diagnosis completed successfully');
    } else {
      logService.log('error', 'Strategy system diagnosis found issues', result, 'StrategyDebug');
      console.error('❌ Strategy system diagnosis found issues:', result.issues);
    }

    return result;
  }

  /**
   * Check authentication status
   */
  private static async checkAuthentication(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🔐 Checking authentication...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        result.issues.push(`Session error: ${sessionError.message}`);
        result.data.sessionError = sessionError;
        return;
      }

      if (!session) {
        result.issues.push('No active session found');
        result.recommendations.push('Please log in to access strategies');
        result.data.hasSession = false;
        return;
      }

      if (!session.user) {
        result.issues.push('Session exists but no user found');
        result.data.hasSession = true;
        result.data.hasUser = false;
        return;
      }

      // Check if session is expired
      const now = Date.now() / 1000;
      if (session.expires_at && session.expires_at < now) {
        result.issues.push('Session has expired');
        result.recommendations.push('Please refresh the page to renew your session');
        result.data.sessionExpired = true;
        return;
      }

      result.data.authentication = {
        hasSession: true,
        hasUser: true,
        userId: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at,
        isExpired: false
      };

      console.log('✅ Authentication check passed');
    } catch (error) {
      result.issues.push(`Authentication check failed: ${error.message}`);
      result.data.authError = error;
    }
  }

  /**
   * Check database connection
   */
  private static async checkDatabaseConnection(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🗄️ Checking database connection...');

      // Test basic connection with a simple query
      const { data, error } = await supabase
        .from('strategies')
        .select('count')
        .limit(1);

      if (error) {
        result.issues.push(`Database connection error: ${error.message}`);
        result.data.dbError = error;
        return;
      }

      result.data.databaseConnection = {
        connected: true,
        testQuerySuccessful: true
      };

      console.log('✅ Database connection check passed');
    } catch (error) {
      result.issues.push(`Database connection test failed: ${error.message}`);
      result.data.dbConnectionError = error;
    }
  }

  /**
   * Check RLS policies
   */
  private static async checkRLSPolicies(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🔒 Checking RLS policies...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        result.warnings.push('Cannot test RLS policies without authenticated user');
        return;
      }

      // Test strategy access
      const { data: strategies, error: strategiesError } = await supabase
        .from('strategies')
        .select('id, user_id, status')
        .limit(5);

      if (strategiesError) {
        if (strategiesError.code === '42501') {
          result.issues.push('RLS policy blocking strategy access - permission denied');
          result.recommendations.push('Check RLS policies for strategies table');
        } else {
          result.issues.push(`Strategy query error: ${strategiesError.message}`);
        }
        result.data.rlsError = strategiesError;
        return;
      }

      result.data.rlsPolicies = {
        strategiesAccessible: true,
        strategiesCount: strategies?.length || 0,
        userStrategies: strategies?.filter(s => s.user_id === session.user.id).length || 0
      };

      console.log('✅ RLS policies check passed');
    } catch (error) {
      result.issues.push(`RLS policy check failed: ${error.message}`);
      result.data.rlsCheckError = error;
    }
  }

  /**
   * Check API connectivity
   */
  private static async checkAPIConnectivity(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🌐 Checking API connectivity...');

      // Test Rust API health
      try {
        const healthResponse = await fetch('http://localhost:8080/health');
        if (healthResponse.ok) {
          result.data.rustAPI = {
            available: true,
            status: healthResponse.status
          };
        } else {
          result.warnings.push(`Rust API returned status ${healthResponse.status}`);
          result.data.rustAPI = {
            available: false,
            status: healthResponse.status
          };
        }
      } catch (apiError) {
        result.warnings.push('Rust API not available, using Supabase fallback');
        result.data.rustAPI = {
          available: false,
          error: apiError.message
        };
      }

      // Test API client
      try {
        await apiClient.checkHealth();
        result.data.apiClient = { working: true };
      } catch (clientError) {
        result.warnings.push(`API client error: ${clientError.message}`);
        result.data.apiClient = { working: false, error: clientError.message };
      }

      console.log('✅ API connectivity check completed');
    } catch (error) {
      result.warnings.push(`API connectivity check failed: ${error.message}`);
      result.data.apiConnectivityError = error;
    }
  }

  /**
   * Check strategy sync service
   */
  private static async checkStrategySyncService(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🔄 Checking strategy sync service...');

      const syncStatus = strategySync.getStatus();
      result.data.strategySync = {
        initialized: syncStatus.initialized,
        syncInProgress: syncStatus.syncInProgress,
        lastSyncTime: syncStatus.lastSyncTime,
        strategiesCount: syncStatus.strategiesCount,
        hasError: syncStatus.hasError,
        errorMessage: syncStatus.errorMessage
      };

      if (!syncStatus.initialized) {
        result.issues.push('Strategy sync service not initialized');
        result.recommendations.push('Try refreshing the page to reinitialize strategy sync');
      }

      if (syncStatus.hasError) {
        result.issues.push(`Strategy sync error: ${syncStatus.errorMessage}`);
      }

      console.log('✅ Strategy sync service check completed');
    } catch (error) {
      result.issues.push(`Strategy sync service check failed: ${error.message}`);
      result.data.strategySyncError = error;
    }
  }

  /**
   * Check demo mode
   */
  private static async checkDemoMode(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('🎮 Checking demo mode...');

      const isDemoMode = demoService.isDemoMode();
      const isInDemoMode = demoService.isInDemoMode();

      result.data.demoMode = {
        isDemoMode,
        isInDemoMode,
        demoServiceInitialized: true
      };

      if (isDemoMode) {
        result.warnings.push('Application is running in demo mode');
      }

      console.log('✅ Demo mode check completed');
    } catch (error) {
      result.warnings.push(`Demo mode check failed: ${error.message}`);
      result.data.demoModeError = error;
    }
  }

  /**
   * Test strategy operations
   */
  private static async testStrategyOperations(result: StrategyDebugResult): Promise<void> {
    try {
      console.log('⚙️ Testing strategy operations...');

      // Test getting strategies
      try {
        const strategies = strategySync.getAllStrategies();
        result.data.strategyOperations = {
          canGetStrategies: true,
          strategiesCount: strategies.length
        };

        if (strategies.length === 0) {
          result.warnings.push('No strategies found - this might be normal for new users');
          result.recommendations.push('Try creating a strategy from the strategy library');
        }
      } catch (getError) {
        result.issues.push(`Cannot get strategies: ${getError.message}`);
        result.data.strategyOperations = {
          canGetStrategies: false,
          error: getError.message
        };
      }

      console.log('✅ Strategy operations test completed');
    } catch (error) {
      result.issues.push(`Strategy operations test failed: ${error.message}`);
      result.data.strategyOperationsError = error;
    }
  }

  /**
   * Quick fix for common issues
   */
  static async quickFix(): Promise<void> {
    console.log('🔧 Attempting quick fixes...');

    try {
      // 1. Refresh session
      await supabase.auth.refreshSession();
      console.log('✅ Session refreshed');

      // 2. Reinitialize strategy sync
      if (!strategySync.getStatus().initialized) {
        await strategySync.initialize();
        console.log('✅ Strategy sync reinitialized');
      }

      // 3. Clear any cached errors
      localStorage.removeItem('strategy-error-cache');
      console.log('✅ Error cache cleared');

    } catch (error) {
      console.error('❌ Quick fix failed:', error);
      logService.log('error', 'Quick fix failed', error, 'StrategyDebug');
    }
  }
}

// Export singleton instance
export const strategyDebugService = StrategyDebugService;
