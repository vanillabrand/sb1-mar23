import React from 'react';
import { useStrategyMonitor } from '../hooks/useStrategyMonitor';
import { Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { PanelWrapper } from './PanelWrapper';
import { formatDate, formatCurrency } from '../lib/format-utils';
import type { Strategy } from '../lib/supabase-types';

interface TradeMonitorProps {
  strategy: Strategy;
}

export function TradeMonitor({ strategy }: TradeMonitorProps) {
  const { isMonitoring, isLoading, trades, error } = useStrategyMonitor(strategy);

  return (
    <PanelWrapper>
      <div className="bg-gunmetal-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold gradient-text">Trade Monitor</h3>
            <p className="text-sm text-gray-400">
              {isMonitoring ? 'Actively monitoring for trades' : 'Monitoring inactive'}
            </p>
          </div>
          <div className="flex items-center">
            {isLoading ? (
              <div className="flex items-center text-gray-400">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </div>
            ) : isMonitoring ? (
              <div className="flex items-center text-neon-turquoise">
                <Check className="w-4 h-4 mr-2" />
                Active
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <X className="w-4 h-4 mr-2" />
                Inactive
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
            {error.message}
          </div>
        )}

        <div className="trade-list">
          {trades.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {isMonitoring ? 'No trades generated yet. Waiting for signals...' : 'Activate the strategy to start monitoring for trades.'}
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map(trade => (
                <div key={trade.id} className="p-3 bg-gunmetal-700 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      trade.direction === 'Long' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.direction}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(new Date(trade.created_at))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                    <div>
                      <span className="text-gray-400">Symbol:</span> {trade.symbol}
                    </div>
                    <div>
                      <span className="text-gray-400">Price:</span> {formatCurrency(trade.entry_price)}
                    </div>
                    <div>
                      <span className="text-gray-400">Stop Loss:</span> {formatCurrency(trade.stop_loss)}
                    </div>
                    <div>
                      <span className="text-gray-400">Take Profit:</span> {formatCurrency(trade.take_profit)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-300 mt-2">
                    <strong>Rationale:</strong> {trade.rationale || 'No rationale provided'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelWrapper>
  );
}
