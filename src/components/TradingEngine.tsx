import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Play,
  Square,
  RefreshCw,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Loader2,
  Zap,
  XCircle,
  Wallet
} from 'lucide-react';
import { PanelWrapper } from './PanelWrapper';
import { AnimatedPanel } from './AnimatedPanel';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import { tradeService } from '../lib/trade-service';
import { strategyService } from '../lib/strategy-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { BudgetConfirmModal } from './BudgetConfirmModal';
import type { Strategy, Trade, StrategyBudget } from '../lib/types';

interface TradingEngineProps {
  className?: string;
}

export function TradingEngine({ className = '' }: TradingEngineProps) {
  // State for strategies and trades
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrades, setActiveTrades] = useState<Record<string, Trade[]>>({});

  // State for UI
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState<Record<string, boolean>>({});
  const [budgets, setBudgets] = useState<Record<string, StrategyBudget>>({});
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  // Load strategies on component mount
  useEffect(() => {
    loadStrategies();
    loadBudgets();
    fetchAvailableBalance();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      fetchAvailableBalance();
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
    };
  }, []);

  // Load strategies from the database
  const loadStrategies = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setStrategies(data);

        // Load trades for active strategies
        const activeStrategies = data.filter(s => s.status === 'active');
        for (const strategy of activeStrategies) {
          loadTradesForStrategy(strategy.id);
        }
      }

    } catch (error) {
      logService.log('error', 'Failed to load strategies', error, 'TradingEngine');
      setError('Failed to load strategies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load budgets for all strategies
  const loadBudgets = () => {
    const allBudgets: Record<string, StrategyBudget> = {};

    strategies.forEach(strategy => {
      const budget = tradeService.getBudget(strategy.id);
      if (budget) {
        allBudgets[strategy.id] = budget;
      }
    });

    setBudgets(allBudgets);
  };

  // Load trades for a specific strategy
  const loadTradesForStrategy = async (strategyId: string) => {
    try {
      // Get active trades
      const { data: activeTradesData, error: activeError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId)
        .in('status', ['pending', 'executed'])
        .order('created_at', { ascending: false });

      if (activeError) {
        throw activeError;
      }

      // Map database fields to our application fields
      const mapTrade = (trade: any): Trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        amount: trade.quantity || trade.amount,
        entryPrice: trade.entry_price || trade.price,
        exitPrice: trade.exit_price || trade.close_price,
        profit: trade.profit,
        timestamp: new Date(trade.created_at).getTime(),
        strategyId: trade.strategy_id,
        createdAt: trade.created_at,
        executedAt: trade.executed_at
      });

      // Update state
      if (activeTradesData) {
        const mappedActiveTrades = activeTradesData.map(mapTrade);
        setActiveTrades(prev => ({
          ...prev,
          [strategyId]: mappedActiveTrades
        }));
      }

    } catch (error) {
      logService.log('error', `Failed to load trades for strategy ${strategyId}`, error, 'TradingEngine');
    }
  };

  // Activate a strategy
  const activateStrategy = async (budget: StrategyBudget) => {
    if (!selectedStrategy) return;

    try {
      setIsActivating(true);

      // 1. Set the budget in the trade service
      await tradeService.setBudget(selectedStrategy.id, budget);

      // 2. Update the strategy status in the database
      await strategyService.activateStrategy(selectedStrategy.id);

      // 3. Update local state
      setStrategies(prev => {
        return prev.map(s => {
          if (s.id === selectedStrategy.id) {
            return { ...s, status: 'active' };
          }
          return s;
        });
      });

      // 4. Update budgets state
      setBudgets(prev => ({
        ...prev,
        [selectedStrategy.id]: budget
      }));

      // 5. Start the BackTrader engine for this strategy
      await startBackTraderForStrategy(selectedStrategy.id);

      // 6. Close modal
      setShowBudgetModal(false);
      setSelectedStrategy(null);

      logService.log('info', `Strategy ${selectedStrategy.id} activated with budget $${budget.total.toFixed(2)}`, null, 'TradingEngine');
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${selectedStrategy.id}`, error, 'TradingEngine');
      setError(`Failed to activate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsActivating(false);
    }
  };

  // Deactivate a strategy
  const deactivateStrategy = async (strategyId: string) => {
    try {
      setIsDeactivating(prev => ({ ...prev, [strategyId]: true }));

      // 1. Update the strategy status in the database
      await strategyService.deactivateStrategy(strategyId);

      // 2. Update local state
      setStrategies(prev => {
        return prev.map(s => {
          if (s.id === strategyId) {
            return { ...s, status: 'inactive' };
          }
          return s;
        });
      });

      // 3. Stop the BackTrader engine for this strategy
      await stopBackTraderForStrategy(strategyId);

      logService.log('info', `Strategy ${strategyId} deactivated`, null, 'TradingEngine');
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${strategyId}`, error, 'TradingEngine');
      setError(`Failed to deactivate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeactivating(prev => ({ ...prev, [strategyId]: false }));
    }
  };

  // Start BackTrader for a strategy
  const startBackTraderForStrategy = async (strategyId: string) => {
    try {
      // This is where we would initialize and start the BackTrader engine
      // For now, we'll just log a message
      logService.log('info', `Starting BackTrader for strategy ${strategyId}`, null, 'TradingEngine');

      // In a real implementation, we would:
      // 1. Initialize BackTrader with the strategy configuration
      // 2. Connect to the exchange (real or demo)
      // 3. Start generating and executing trades

      // For demo purposes, let's simulate some trades after a delay
      if (demoService.isDemoMode()) {
        setTimeout(() => {
          generateDemoTrades(strategyId);
        }, 2000);
      }

      return true;
    } catch (error) {
      logService.log('error', `Failed to start BackTrader for strategy ${strategyId}`, error, 'TradingEngine');
      return false;
    }
  };

  // Stop BackTrader for a strategy
  const stopBackTraderForStrategy = async (strategyId: string) => {
    try {
      // This is where we would stop the BackTrader engine
      // For now, we'll just log a message
      logService.log('info', `Stopping BackTrader for strategy ${strategyId}`, null, 'TradingEngine');

      // In a real implementation, we would:
      // 1. Stop the BackTrader engine
      // 2. Close any open trades
      // 3. Clean up resources

      return true;
    } catch (error) {
      logService.log('error', `Failed to stop BackTrader for strategy ${strategyId}`, error, 'TradingEngine');
      return false;
    }
  };

  // Fetch available balance
  const fetchAvailableBalance = async () => {
    try {
      setIsRefreshingBalance(true);
      const balance = walletBalanceService.getAvailableBalance('USDT');
      setAvailableBalance(balance);
      logService.log('info', `Fetched available balance: ${balance} USDT`, null, 'TradingEngine');
    } catch (error) {
      logService.log('error', 'Failed to fetch available balance', error, 'TradingEngine');
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Refresh balance manually
  const refreshBalance = async () => {
    try {
      setIsRefreshingBalance(true);
      await walletBalanceService.refreshBalances();
      // The balance will be updated via the event listener
    } catch (error) {
      logService.log('error', 'Failed to refresh balance', error, 'TradingEngine');
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Generate demo trades for testing
  const generateDemoTrades = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    const budget = budgets[strategyId];
    if (!budget || budget.available < 10) return;

    // Create 1-3 random trades
    const numTrades = Math.floor(Math.random() * 3) + 1;
    const maxAmount = budget.available * 0.2; // Max 20% of available budget per trade

    const newTrades: Trade[] = [];

    for (let i = 0; i < numTrades; i++) {
      // Pick a random pair, ensuring we use USDT pairs
      let pairs = strategy.selected_pairs || ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

      // Ensure all pairs use USDT
      pairs = pairs.map(pair => {
        if (pair.includes('/USDT')) return pair;
        if (pair.includes('_USDT')) return pair.replace('_USDT', '/USDT');
        if (pair.includes('/')) return pair.split('/')[0] + '/USDT';
        if (pair.includes('_')) return pair.split('_')[0] + '/USDT';
        return pair + '/USDT';
      });

      const pair = pairs[Math.floor(Math.random() * pairs.length)];

      // Calculate amount (between 5% and 15% of available budget)
      const percentage = 0.05 + (Math.random() * 0.1);
      const amount = Math.min(budget.available * percentage, maxAmount);

      // Determine market type, defaulting to spot if not specified
      const marketType = strategy.market_type || 'spot';

      // Create trade
      const trade: Trade = {
        id: `demo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        symbol: pair,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        status: 'pending',
        amount,
        entryPrice: Math.random() * 1000 + 100, // Random price between 100 and 1100
        timestamp: Date.now(),
        strategyId: strategy.id,
        createdAt: new Date().toISOString(),
        executedAt: null,
        // Only include leverage for futures trading
        ...(marketType === 'futures' ? { leverage: Math.floor(Math.random() * 5) + 1 } : {}),
        marketType: marketType
      };

      newTrades.push(trade);
    }

    // Add to active trades
    setActiveTrades(prev => {
      return {
        ...prev,
        [strategyId]: [...(prev[strategyId] || []), ...newTrades]
      };
    });

    // Simulate trade execution after a random delay
    newTrades.forEach(trade => {
      setTimeout(() => {
        // Update trade status to executed
        setActiveTrades(prev => {
          const existingTrades = prev[strategyId] || [];
          return {
            ...prev,
            [strategyId]: existingTrades.map(t => {
              if (t.id === trade.id) {
                return { ...t, status: 'executed', executedAt: new Date().toISOString() };
              }
              return t;
            })
          };
        });
      }, 2000 + Math.random() * 5000); // 2-7 seconds
    });
  };

  // Render loading state
  if (isLoading) {
    return (
      <PanelWrapper title="Trading Engine" icon={<BarChart3 className="w-5 h-5" />} className="bg-black">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-neon-raspberry" />
          <span className="ml-2 text-lg">Loading Trading Engine...</span>
        </div>
      </PanelWrapper>
    );
  }

  // Render error state
  if (error) {
    return (
      <PanelWrapper title="Trading Engine" icon={<BarChart3 className="w-5 h-5" />} className="bg-black">
        <div className="flex items-center justify-center h-64">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="ml-2 text-lg text-red-500">{error}</span>
        </div>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Trading Engine" icon={<BarChart3 className="w-5 h-5" />} className="bg-black">
      <div className="p-8 space-y-8 pb-24 sm:pb-8 mobile-p-4" style={{ minHeight: '100vh' }}>
        {/* Introduction Section */}
        <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="gradient-text mb-3">Trading Engine</h2>
              <p className="description-text mb-4">
                Activate your strategies to automatically generate and execute trades using BackTrader.
                {demoService.isDemoMode() && (
                  <span className="ml-2 text-neon-yellow">
                    Currently running in Demo Mode using TestNet.
                  </span>
                )}
              </p>
            </div>
            <div className="bg-gunmetal-800/50 p-3 rounded-lg flex items-center space-x-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Wallet className="w-4 h-4 text-neon-turquoise" />
                  <span className="text-sm text-gray-400">Available Balance</span>
                  {isRefreshingBalance ? (
                    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                  ) : (
                    <RefreshCw
                      className="w-3 h-3 text-gray-400 cursor-pointer hover:text-white"
                      onClick={refreshBalance}
                    />
                  )}
                </div>
                <div className="text-xl font-semibold text-neon-turquoise">
                  ${availableBalance.toFixed(2)} <span className="text-xs text-gray-400">USDT</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Strategies List */}
        <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
          <h3 className="gradient-text mb-4">Your Strategies</h3>

          {strategies.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No strategies found</p>
              <button
                className="px-4 py-2 bg-neon-raspberry text-white rounded-md"
                onClick={() => window.location.href = '/strategy-manager'}
              >
                Create a Strategy
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {strategies.map(strategy => (
                <div
                  key={strategy.id}
                  className="bg-gunmetal-800/50 rounded-lg p-4 hover:bg-gunmetal-800/80 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <h4 className="text-lg font-semibold">{strategy.title}</h4>
                        <span className="ml-3 px-2 py-1 text-xs rounded-full bg-gunmetal-700">
                          {strategy.market_type || 'spot'}
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          strategy.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {strategy.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                      <div className="mt-2 flex items-center text-xs text-gray-400">
                        <span className="mr-3">Risk Level: <span className="text-white">{strategy.riskLevel}</span></span>
                        <span>Pairs: <span className="text-white">{strategy.selected_pairs?.length || 0}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {strategy.status === 'active' ? (
                        <button
                          className="px-3 py-1 rounded-md text-sm bg-red-500 hover:bg-red-600 text-white flex items-center"
                          onClick={() => deactivateStrategy(strategy.id)}
                          disabled={isDeactivating[strategy.id]}
                        >
                          {isDeactivating[strategy.id] ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Deactivate
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 rounded-md text-sm bg-neon-raspberry hover:bg-neon-raspberry/90 text-white flex items-center"
                          onClick={() => {
                            setSelectedStrategy(strategy);
                            setShowBudgetModal(true);
                          }}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Activate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Show budget and trades if strategy is active */}
                  {strategy.status === 'active' && (
                    <div className="mt-4 pt-4 border-t border-gunmetal-700/50">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-gunmetal-700/30 p-2 rounded-lg">
                          <h5 className="text-xs text-gray-400 mb-1">Budget</h5>
                          <p className="text-sm font-semibold">
                            ${budgets[strategy.id]?.total ? budgets[strategy.id].total.toFixed(2) : '0.00'}
                          </p>
                        </div>
                        <div className="bg-gunmetal-700/30 p-2 rounded-lg">
                          <h5 className="text-xs text-gray-400 mb-1">Available</h5>
                          <p className="text-sm font-semibold">
                            ${budgets[strategy.id]?.available ? budgets[strategy.id].available.toFixed(2) : '0.00'}
                          </p>
                        </div>
                        <div className="bg-gunmetal-700/30 p-2 rounded-lg">
                          <h5 className="text-xs text-gray-400 mb-1">Active Trades</h5>
                          <p className="text-sm font-semibold">
                            {activeTrades[strategy.id]?.length || 0}
                          </p>
                        </div>
                      </div>

                      {/* Show active trades */}
                      {activeTrades[strategy.id] && activeTrades[strategy.id].length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-gray-400 text-xs">
                                <th className="text-left py-1">Symbol</th>
                                <th className="text-left py-1">Side</th>
                                <th className="text-left py-1">Amount</th>
                                <th className="text-left py-1">Entry Price</th>
                                <th className="text-left py-1">Market</th>
                                <th className="text-left py-1">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeTrades[strategy.id].map(trade => (
                                <tr key={trade.id} className="border-t border-gunmetal-700/30">
                                  <td className="py-2">{trade.symbol}</td>
                                  <td className="py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      trade.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                    }`}>
                                      {trade.side.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-2">{trade.amount ? trade.amount.toFixed(6) : '0.000000'}</td>
                                  <td className="py-2">${trade.entryPrice ? trade.entryPrice.toFixed(2) : '0.00'}</td>
                                  <td className="py-2">
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-gunmetal-700">
                                      {trade.marketType || 'spot'}
                                      {trade.marketType === 'futures' && trade.leverage && (
                                        <span className="ml-1 text-neon-yellow">{trade.leverage}x</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      trade.status === 'executed' ? 'bg-blue-500/20 text-blue-500' : 'bg-yellow-500/20 text-yellow-500'
                                    }`}>
                                      {trade.status.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs text-center py-2">
                          No active trades for this strategy yet. Trades will be generated automatically.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Trades Section */}
        <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="gradient-text">Active Trades</h3>
            <button
              className="px-3 py-1 bg-gunmetal-700 hover:bg-gunmetal-600 text-white rounded-md flex items-center text-sm"
              onClick={() => {
                // Refresh trades for all active strategies
                strategies
                  .filter(s => s.status === 'active')
                  .forEach(s => loadTradesForStrategy(s.id));
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </button>
          </div>

          {Object.values(activeTrades).flat().length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-gray-400 text-xs">
                    <th className="text-left py-2">Strategy</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Entry Price</th>
                    <th className="text-left py-2">Market</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gunmetal-700/30">
                  {Object.entries(activeTrades).flatMap(([strategyId, trades]) => {
                    const strategy = strategies.find(s => s.id === strategyId);
                    return trades.map(trade => (
                      <tr key={trade.id} className="hover:bg-gunmetal-800/30">
                        <td className="py-2 pr-4">{strategy?.title || 'Unknown'}</td>
                        <td className="py-2 pr-4">{trade.symbol}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            trade.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                          }`}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{trade.amount ? trade.amount.toFixed(6) : '0.000000'}</td>
                        <td className="py-2 pr-4">${trade.entryPrice ? trade.entryPrice.toFixed(2) : '0.00'}</td>
                        <td className="py-2 pr-4">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-gunmetal-700">
                            {trade.marketType || strategy?.market_type || 'spot'}
                            {(trade.marketType === 'futures' || strategy?.market_type === 'futures') && trade.leverage && (
                              <span className="ml-1 text-neon-yellow">{trade.leverage}x</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            trade.status === 'executed' ? 'bg-blue-500/20 text-blue-500' : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {trade.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-400 text-xs">
                          {new Date(trade.createdAt || Date.now()).toLocaleTimeString()}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">
                No active trades at the moment. Activate a strategy to start trading.
              </p>
            </div>
          )}
        </div>

        {/* Performance Analytics Section */}
        <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
          <h3 className="gradient-text mb-4">Performance Analytics</h3>

          {Object.keys(budgets).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Total Budget</h4>
                <p className="text-2xl font-semibold">
                  ${Object.values(budgets).reduce((sum, budget) => sum + (budget.total || 0), 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Available Balance</h4>
                <p className="text-2xl font-semibold">
                  ${Object.values(budgets).reduce((sum, budget) => sum + (budget.available || 0), 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Active Strategies</h4>
                <p className="text-2xl font-semibold">
                  {strategies.filter(s => s.status === 'active').length}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Active Trades</h4>
                <p className="text-2xl font-semibold">
                  {Object.values(activeTrades).flat().length}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              Performance data will appear here once you have active strategies.
            </p>
          )}
        </div>

        {/* Budget Confirmation Modal */}
        {showBudgetModal && selectedStrategy && (
          <BudgetConfirmModal
            strategy={selectedStrategy}
            isOpen={showBudgetModal}
            onClose={() => {
              setShowBudgetModal(false);
              setSelectedStrategy(null);
            }}
            onConfirm={activateStrategy}
          />
        )}
      </div>
    </PanelWrapper>
  );
}
