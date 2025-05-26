import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bug, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Database,
  Key,
  Server,
  User,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { strategySync } from '../lib/strategy-sync';
import { apiClient } from '../lib/api-client';
import { demoService } from '../lib/demo-service';
import { strategyService } from '../lib/strategy-service';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export function StrategyDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    
    const diagnostics: DiagnosticResult[] = [];

    // 1. Check Authentication
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        diagnostics.push({
          name: 'Authentication',
          status: 'error',
          message: `Session error: ${error.message}`,
          details: error
        });
      } else if (!session) {
        diagnostics.push({
          name: 'Authentication',
          status: 'error',
          message: 'No active session found',
          details: { hasSession: false }
        });
      } else if (!session.user) {
        diagnostics.push({
          name: 'Authentication',
          status: 'error',
          message: 'Session exists but no user found',
          details: { hasSession: true, hasUser: false }
        });
      } else {
        diagnostics.push({
          name: 'Authentication',
          status: 'success',
          message: `Authenticated as ${session.user.email}`,
          details: { 
            userId: session.user.id,
            email: session.user.email,
            expiresAt: session.expires_at
          }
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'Authentication',
        status: 'error',
        message: `Auth check failed: ${error.message}`,
        details: error
      });
    }

    // 2. Check Database Connection
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('count')
        .limit(1);

      if (error) {
        diagnostics.push({
          name: 'Database Connection',
          status: 'error',
          message: `Database error: ${error.message}`,
          details: error
        });
      } else {
        diagnostics.push({
          name: 'Database Connection',
          status: 'success',
          message: 'Database connection successful',
          details: { connected: true }
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'Database Connection',
        status: 'error',
        message: `Database connection failed: ${error.message}`,
        details: error
      });
    }

    // 3. Check RLS Policies
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: strategies, error } = await supabase
          .from('strategies')
          .select('id, user_id, status')
          .limit(5);

        if (error) {
          if (error.code === '42501') {
            diagnostics.push({
              name: 'RLS Policies',
              status: 'error',
              message: 'Permission denied - RLS policy blocking access',
              details: error
            });
          } else {
            diagnostics.push({
              name: 'RLS Policies',
              status: 'error',
              message: `RLS error: ${error.message}`,
              details: error
            });
          }
        } else {
          diagnostics.push({
            name: 'RLS Policies',
            status: 'success',
            message: `RLS policies working - found ${strategies?.length || 0} strategies`,
            details: { strategiesCount: strategies?.length || 0 }
          });
        }
      } else {
        diagnostics.push({
          name: 'RLS Policies',
          status: 'warning',
          message: 'Cannot test RLS without authenticated user',
          details: { noUser: true }
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'RLS Policies',
        status: 'error',
        message: `RLS check failed: ${error.message}`,
        details: error
      });
    }

    // 4. Check API Connectivity
    try {
      const healthResponse = await fetch('http://localhost:8080/health');
      if (healthResponse.ok) {
        diagnostics.push({
          name: 'Rust API',
          status: 'success',
          message: 'Rust API is responding',
          details: { status: healthResponse.status }
        });
      } else {
        diagnostics.push({
          name: 'Rust API',
          status: 'warning',
          message: `Rust API returned status ${healthResponse.status}`,
          details: { status: healthResponse.status }
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'Rust API',
        status: 'warning',
        message: 'Rust API not available - using Supabase fallback',
        details: { error: error.message }
      });
    }

    // 5. Check Strategy Sync Service
    try {
      const syncStatus = strategySync.getStatus();
      if (!syncStatus.initialized) {
        diagnostics.push({
          name: 'Strategy Sync',
          status: 'error',
          message: 'Strategy sync service not initialized',
          details: syncStatus
        });
      } else if (syncStatus.hasError) {
        diagnostics.push({
          name: 'Strategy Sync',
          status: 'error',
          message: `Strategy sync error: ${syncStatus.errorMessage}`,
          details: syncStatus
        });
      } else {
        diagnostics.push({
          name: 'Strategy Sync',
          status: 'success',
          message: `Strategy sync working - ${syncStatus.strategiesCount} strategies`,
          details: syncStatus
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'Strategy Sync',
        status: 'error',
        message: `Strategy sync check failed: ${error.message}`,
        details: error
      });
    }

    // 6. Test Strategy Creation
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Test creating a minimal strategy
        const testStrategy = {
          id: 'test-strategy-' + Date.now(),
          name: 'Test Strategy',
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
          diagnostics.push({
            name: 'Strategy Creation',
            status: 'error',
            message: `Cannot create strategies: ${error.message}`,
            details: error
          });
        } else {
          // Clean up test strategy
          await supabase.from('strategies').delete().eq('id', data.id);
          
          diagnostics.push({
            name: 'Strategy Creation',
            status: 'success',
            message: 'Strategy creation test successful',
            details: { testPassed: true }
          });
        }
      } else {
        diagnostics.push({
          name: 'Strategy Creation',
          status: 'warning',
          message: 'Cannot test strategy creation without authenticated user',
          details: { noUser: true }
        });
      }
    } catch (error) {
      diagnostics.push({
        name: 'Strategy Creation',
        status: 'error',
        message: `Strategy creation test failed: ${error.message}`,
        details: error
      });
    }

    setResults(diagnostics);
    setIsRunning(false);
  };

  const quickFix = async () => {
    try {
      // Refresh session
      await supabase.auth.refreshSession();
      
      // Reinitialize strategy sync
      await strategySync.initialize();
      
      // Clear error cache
      localStorage.removeItem('strategy-error-cache');
      
      logService.log('info', 'Quick fix applied', null, 'StrategyDebugPanel');
      
      // Re-run diagnostics
      await runDiagnostics();
    } catch (error) {
      logService.log('error', 'Quick fix failed', error, 'StrategyDebugPanel');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-neon-raspberry rounded-full shadow-lg hover:bg-neon-raspberry/80 transition-colors z-50"
        title="Open Strategy Debug Panel"
      >
        <Bug className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed top-4 right-4 w-96 bg-gunmetal-900 rounded-lg shadow-xl border border-gunmetal-700 z-50 max-h-[80vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gunmetal-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-neon-raspberry" />
          <h3 className="font-semibold text-white">Strategy Diagnostics</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </button>
          
          <button
            onClick={quickFix}
            className="flex items-center gap-2 px-3 py-2 bg-neon-yellow text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Quick Fix
          </button>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={index}
              className="p-3 bg-gunmetal-800 rounded-lg border border-gunmetal-600"
            >
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(result.status)}
                <span className="font-medium text-white">{result.name}</span>
              </div>
              <p className="text-sm text-gray-300 mb-2">{result.message}</p>
              {result.details && (
                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-300">Details</summary>
                  <pre className="mt-2 p-2 bg-gunmetal-950 rounded text-xs overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-gray-400">
            <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Run Diagnostics" to check system status</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
