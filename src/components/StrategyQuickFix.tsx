import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wrench, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  Database,
  User,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { strategySync } from '../lib/strategy-sync';
import { StrategyDiagnostics } from '../lib/strategy-diagnostics';

export function StrategyQuickFix() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [fixApplied, setFixApplied] = useState(false);

  const runQuickFix = async () => {
    setIsRunning(true);
    setFixApplied(false);
    
    try {
      console.log('🔧 Running strategy quick fix...');
      
      // 1. Run diagnostics first
      const diagnosticResults = await StrategyDiagnostics.runQuickDiagnostic();
      setResults(diagnosticResults);
      
      // 2. Apply fixes for any errors found
      await StrategyDiagnostics.applyQuickFixes(diagnosticResults);
      
      // 3. Additional manual fixes
      await applyManualFixes();
      
      // 4. Re-run diagnostics to verify fixes
      const postFixResults = await StrategyDiagnostics.runQuickDiagnostic();
      setResults(postFixResults);
      
      setFixApplied(true);
      
      // 5. Force refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error('Quick fix failed:', error);
      logService.log('error', 'Strategy quick fix failed', error, 'StrategyQuickFix');
    } finally {
      setIsRunning(false);
    }
  };

  const applyManualFixes = async () => {
    try {
      console.log('🔧 Applying manual fixes...');
      
      // 1. Clear all cached data
      localStorage.removeItem('strategy-error-cache');
      localStorage.removeItem('strategy-sync-error');
      localStorage.removeItem('supabase.auth.token');
      
      // 2. Refresh authentication session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn('Session refresh failed:', refreshError);
      } else {
        console.log('✅ Session refreshed');
      }
      
      // 3. Reinitialize strategy sync
      try {
        await strategySync.initialize();
        console.log('✅ Strategy sync reinitialized');
      } catch (syncError) {
        console.warn('Strategy sync initialization failed:', syncError);
      }
      
      // 4. Test database connection
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from('strategies')
            .select('count')
            .limit(1);
          
          if (error) {
            console.warn('Database test failed:', error);
          } else {
            console.log('✅ Database connection verified');
          }
        }
      } catch (dbError) {
        console.warn('Database test error:', dbError);
      }
      
      // 5. Clear browser cache for the app
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
      
    } catch (error) {
      console.error('Manual fixes failed:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 p-3 bg-neon-yellow rounded-full shadow-lg hover:bg-neon-yellow/80 transition-colors z-50"
        title="Strategy Quick Fix"
      >
        <Wrench className="w-6 h-6 text-gunmetal-950" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-4 bg-gunmetal-900 rounded-lg shadow-xl border border-gunmetal-700 z-50 flex flex-col max-w-md mx-auto my-auto h-fit max-h-[80vh]"
    >
      {/* Header */}
      <div className="p-4 border-b border-gunmetal-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-neon-yellow" />
          <h3 className="font-semibold text-white">Strategy Quick Fix</h3>
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
        <div className="space-y-4">
          <div className="text-sm text-gray-300">
            This tool will diagnose and fix common strategy loading and activation issues.
          </div>

          <button
            onClick={runQuickFix}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neon-yellow text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Fix...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Run Quick Fix
              </>
            )}
          </button>

          {fixApplied && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Fix Applied!</span>
              </div>
              <p className="text-sm text-green-300 mt-1">
                The page will reload automatically to apply changes.
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-white">Diagnostic Results:</h4>
              {results.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-gunmetal-800 rounded-lg border border-gunmetal-600"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(result.status)}
                    <span className="font-medium text-white text-sm">{result.component}</span>
                  </div>
                  <p className="text-xs text-gray-300">{result.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Manual Actions */}
          <div className="space-y-2">
            <h4 className="font-medium text-white">Manual Actions:</h4>
            <div className="space-y-2 text-sm">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
              
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                Clear All Data & Refresh
              </button>
            </div>
          </div>

          {/* Common Issues */}
          <div className="space-y-2">
            <h4 className="font-medium text-white">Common Issues:</h4>
            <div className="text-xs text-gray-400 space-y-1">
              <p>• Authentication session expired</p>
              <p>• Database connection issues</p>
              <p>• Strategy sync service not initialized</p>
              <p>• Cached data corruption</p>
              <p>• RLS policy blocking access</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
