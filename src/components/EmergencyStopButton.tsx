import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Power,
  X,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { marketService } from '../lib/market-service';
import { tradeService } from '../lib/trade-service';
import { tradeManager } from '../lib/trade-manager';
import { logService } from '../lib/log-service';
import { useStrategies } from '../hooks/useStrategies';
import { supabase } from '../lib/supabase';
import { strategyMonitor } from '../lib/strategy-monitor';
import { tradeGenerator } from '../lib/trade-generator';
import { tradeEngine } from '../lib/trade-engine';

interface EmergencyStopButtonProps {
  className?: string;
}

export function EmergencyStopButton({ className = '' }: EmergencyStopButtonProps) {
  const { strategies, updateStrategy, refresh } = useStrategies();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  const handleEmergencyStop = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      logService.log(
        'warn',
        'Emergency stop initiated',
        null,
        'EmergencyStopButton'
      );

      // Get all active strategies
      const activeStrategies = strategies.filter((s) => s.status === 'active');
      setProgress({
        current: 0,
        total: activeStrategies.length,
        message: 'Initiating emergency stop...',
      });

      // Stop each strategy and close its trades
      for (const [index, strategy] of activeStrategies.entries()) {
        try {
          setProgress({
            current: index + 1,
            total: activeStrategies.length,
            message: `Processing strategy ${index + 1} of ${
              activeStrategies.length
            }: ${strategy.title}`,
          });

          // Step 1: Get all active and pending trades for this strategy from the database
          const { data: activeTrades, error: fetchError } = await supabase
            .from('trades')
            .select('*')
            .eq('strategy_id', strategy.id)
            .in('status', ['open', 'pending']);

          if (fetchError) {
            throw new Error(`Failed to fetch trades: ${fetchError.message}`);
          }

          logService.log(
            'info',
            `Found ${activeTrades?.length || 0} active/pending trades for strategy ${strategy.id}`,
            null,
            'EmergencyStopButton'
          );

          // Step 2: Close all active trades
          if (activeTrades && activeTrades.length > 0) {
            for (const trade of activeTrades) {
              try {
                // Close the trade through the trade manager
                await tradeManager.closeTrade(trade.id, 'Emergency stop');

                // Update trade status in database directly as a fallback
                await supabase
                  .from('trades')
                  .update({
                    status: 'closed',
                    close_reason: 'Emergency stop',
                    closed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', trade.id);

                logService.log(
                  'info',
                  `Closed trade ${trade.id} for strategy ${strategy.id}`,
                  null,
                  'EmergencyStopButton'
                );
              } catch (tradeError) {
                logService.log(
                  'error',
                  `Error closing trade ${trade.id}`,
                  tradeError,
                  'EmergencyStopButton'
                );
                // Continue with other trades even if one fails
              }
            }
          }

          // Step 3: Delete any remaining trades
          const { error: deleteError } = await supabase
            .from('trades')
            .delete()
            .eq('strategy_id', strategy.id)
            .in('status', ['draft', 'pending']);

          if (deleteError) {
            logService.log(
              'error',
              `Error deleting remaining trades for strategy ${strategy.id}`,
              deleteError,
              'EmergencyStopButton'
            );
          }

          // Step 4: Stop all monitoring services for this strategy
          try {
            // Stop market monitoring
            await marketService.stopStrategyMonitoring(strategy.id);

            // Stop strategy monitoring
            await strategyMonitor.removeStrategy(strategy.id);

            // Remove from trade generator
            if (tradeGenerator.removeStrategy) {
              await tradeGenerator.removeStrategy(strategy.id);
            }

            // Remove from trade engine
            if (tradeEngine.removeStrategy) {
              await tradeEngine.removeStrategy(strategy.id);
            }
          } catch (monitorError) {
            logService.log(
              'error',
              `Error stopping monitoring for strategy ${strategy.id}`,
              monitorError,
              'EmergencyStopButton'
            );
          }

          // Step 5: Clear strategy budget
          await tradeService.setBudget(strategy.id, null);

          // Step 6: Update strategy status to inactive
          await updateStrategy(strategy.id, {
            status: 'inactive',
            updated_at: new Date().toISOString(),
          });

          // Also update directly in the database as a fallback
          await supabase
            .from('strategies')
            .update({
              status: 'inactive',
              updated_at: new Date().toISOString()
            })
            .eq('id', strategy.id);

          logService.log(
            'info',
            `Stopped strategy ${strategy.id} and processed ${activeTrades?.length || 0} trades`,
            null,
            'EmergencyStopButton'
          );
        } catch (error) {
          logService.log(
            'error',
            `Error stopping strategy ${strategy.id}`,
            error,
            'EmergencyStopButton'
          );
          // Continue with other strategies even if one fails
        }
      }

      // Clear all budgets
      tradeService.clearAllBudgets();

      // Refresh strategies list to reflect changes
      refresh();

      setIsComplete(true);
      setTimeout(() => {
        setIsConfirmOpen(false);
        setIsComplete(false);
      }, 2000);

      logService.log(
        'info',
        'Emergency stop completed successfully',
        null,
        'EmergencyStopButton'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to complete emergency stop';
      setError(errorMessage);
      logService.log(
        'error',
        'Emergency stop failed',
        error,
        'EmergencyStopButton'
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <>
      {/* Title */}
      <h3 className="text-lg font-semibold gradient-text flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5" />
        EMERGENCY STOP
      </h3>

      {/* Emergency Stop Button */}
      <div className="relative aspect-square w-full max-w-[200px] mx-auto">
        {/* Rotating text - moved to top layer but with pointer-events-none */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute inset-0 animate-spin-slow">
            {Array.from('PRESS TO STOP ').map((char, i) => {
              const angle = (i * 360) / 14;
              const radian = (angle * Math.PI) / 180;
              const x = 50 + 45 * Math.cos(radian - Math.PI / 2);
              const y = 50 + 45 * Math.sin(radian - Math.PI / 2);
              return (
                <div
                  key={i}
                  className="absolute text-neon-pink font-bold text-lg"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`
                  }}
                >
                  {char}
                </div>
              );
            })}
          </div>
        </div>

        {/* Button base shadow/glow effect */}
        <div className="absolute inset-4 rounded-full bg-red-600/20 blur-xl animate-pulse" />

        {/* Metallic ring with pointer events disabled */}
        <div className="absolute inset-0 rounded-full border-8 border-gunmetal-700 shadow-lg pointer-events-none" />

        {/* Main button */}
        <motion.button
          onClick={() => setIsConfirmOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="absolute inset-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-[inset_0_2px_15px_rgba(255,255,255,0.3)] hover:from-red-600 hover:to-red-800 transition-all duration-300 group overflow-hidden cursor-pointer"
        >
          {/* Inner button details */}
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10 rounded-full" />
            <Power className="w-12 h-12 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </motion.button>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
            >
              {!isComplete ? (
                <>
                  <div className="flex items-center gap-3 mb-6 text-neon-pink">
                    <AlertTriangle className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Emergency Stop</h2>
                  </div>

                  {error ? (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  ) : (
                    <div className="text-gray-300 mb-6">
                      <p className="mb-4">This will immediately:</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                          <span>Stop all active trading strategies</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                          <span>Close all open positions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                          <span>Cancel all pending orders</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {progress && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">
                          {progress.message}
                        </span>
                        <span className="text-neon-pink">
                          {progress.current}/{progress.total}
                        </span>
                      </div>
                      <div className="w-full bg-gunmetal-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-neon-pink transition-all duration-300"
                          style={{
                            width: `${
                              (progress.current / progress.total) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setIsConfirmOpen(false)}
                      disabled={isProcessing}
                      className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEmergencyStop}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-red-500 transition-all duration-300 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Stopping...
                        </>
                      ) : (
                        'Stop All Trading'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">
                    Trading Stopped Successfully
                  </h3>
                  <p className="text-gray-400">
                    All trading activities have been safely terminated.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
