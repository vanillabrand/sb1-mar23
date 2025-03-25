import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock,
  Loader2,
  Filter,
  Search,
  DollarSign,
  Target,
  Gauge,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  X,
  Power,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Brain,
  AlertTriangle,
  Eye,
  Sparkles,
  Sliders,
  Scale,
  Coins,
  Hash
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { marketService } from '../lib/market-service';
import { BudgetControl } from './BudgetControl';
import { tradeGenerator } from '../lib/trade-generator';
import { marketMonitor } from '../lib/market-monitor';
import { logService } from '../lib/log-service';
import { BudgetModal } from './BudgetModal';
import { tradeService } from '../lib/trade-service';
import { AssetPairMonitor } from './AssetPairMonitor';
import { tradeManager } from '../lib/trade-manager';
import { analyticsService } from '../lib/analytics-service';
import { supabase } from '../lib/supabase';
import type { Strategy } from '../lib/supabase-types';
import type { StrategyBudget } from '../lib/types';
import { PanelWrapper } from './PanelWrapper';

interface TradeSignal {
  id: string;
  strategy_id: string;
  symbol: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  trailing_stop?: number;
  confidence: number;
  indicators: Record<string, number>;
  rationale: string;
  status: 'pending' | 'executed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  executed_at?: string;
}

export default function TradeMonitor() {
  const {
    strategies,
    loading: strategiesLoading,
    updateStrategy,
    refresh,
  } = useStrategies();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [monitoringInitialized, setMonitoringInitialized] = useState(false);
  const [deactivatingStrategy, setDeactivatingStrategy] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [monitoringStatus, setMonitoringStatus] = useState<
    Map<string, MonitoringStatus>
  >(new Map());

  interface MonitoringStatus {
    status: 'monitoring' | 'generating' | 'executing' | 'idle';
    message: string;
    timestamp: number;
    progress?: number;
    conditions?: {
      name: string;
      value: number;
      target: number;
      met: boolean;
    }[];
    indicators?: Record<string, number>;
    signal?: TradeSignal;
  }

  const itemsPerPage = 3;

  // Initialize monitoring once strategies are loaded
  useEffect(() => {
    if (!strategiesLoading && !monitoringInitialized) {
      initializeMonitoring().then(() => setLoading(false));
    }
  }, [strategiesLoading, monitoringInitialized]);

  // Set up periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Refresh data when lastUpdate changes
  useEffect(() => {
    if (monitoringInitialized) {
      refresh();
    }
  }, [lastUpdate, monitoringInitialized]);

  // Register trade event listeners
  useEffect(() => {
    const handleTradeOpportunity = async (data: any) => {
      const { strategy, signal } = data;
      updateMonitoringStatus(strategy.id, 'generating', 'Trade opportunity detected', {
        indicators: signal.indicators,
        signal,
      });

      try {
        const { data: trade, error } = await supabase
          .from('strategy_trades')
          .insert({
            strategy_id: strategy.id,
            pair: signal.symbol,
            type: signal.direction,
            entry_price: signal.entry_price,
            current_price: signal.entry_price,
            amount: signal.entry.amount,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;

        updateMonitoringStatus(strategy.id, 'executing', 'Executing trade signal', {
          indicators: signal.indicators,
          signal,
        });
        tradeManager.emit('tradeExecuted', { trade });
        setLastUpdate(Date.now()); // Trigger refresh after trade execution
      } catch (error) {
        logService.log('error', 'Failed to store trade signal', error, 'TradeMonitor');
        updateMonitoringStatus(strategy.id, 'monitoring', 'Failed to execute trade');
      }
    };

    const handleTradeExecution = (data: any) => {
      const { trade } = data;
      updateMonitoringStatus(trade.strategy_id, 'monitoring', 'Trade executed successfully');
      setLastUpdate(Date.now()); // Trigger refresh after trade execution
    };

    tradeGenerator.on('tradeOpportunity', handleTradeOpportunity);
    tradeManager.on('tradeExecuted', handleTradeExecution);

    return () => {
      tradeGenerator.off('tradeOpportunity', handleTradeOpportunity);
      tradeManager.off('tradeExecuted', handleTradeExecution);
    };
  }, []);

  const updateMonitoringStatus = (
    strategyId: string,
    status: 'monitoring' | 'generating' | 'executing' | 'idle',
    message: string,
    data?: {
      indicators?: Record<string, number>;
      signal?: TradeSignal;
    }
  ) => {
    setMonitoringStatus(prev => {
      const newStatus = new Map(prev);
      newStatus.set(strategyId, {
        status,
        message,
        timestamp: Date.now(),
        ...data,
      });
      return newStatus;
    });
  };

  const initializeMonitoring = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logService.log('info', 'Initializing monitoring...', { strategies }, 'TradeMonitor');
      
      await marketService.initialize();

      const activeStrategies = strategies.filter(s => s.status === 'active');
      for (const strategy of activeStrategies) {
        await startStrategyMonitoring(strategy);
      }

      setMonitoringInitialized(true);
      setLoading(false);
      logService.log(
        'info',
        `Initialized monitoring for ${activeStrategies.length} strategies`,
        null,
        'TradeMonitor'
      );
    } catch (error) {
      setError('Failed to initialize monitoring');
      logService.log('error', 'Error initializing monitoring:', error, 'TradeMonitor');
    }
  };

  const startStrategyMonitoring = async (strategy: Strategy) => {
    try {
      logService.log('info', `Starting monitoring for strategy: ${strategy.id}`, strategy, 'TradeMonitor');

      if (strategy.strategy_config?.assets) {
        for (const asset of strategy.strategy_config.assets) {
          await marketMonitor.addAsset(asset);
        }
      }

      await marketService.startStrategyMonitoring(strategy);
      updateMonitoringStatus(strategy.id, 'monitoring', 'Actively monitoring market conditions');
      logService.log('info', `Successfully started monitoring for strategy: ${strategy.id}`, null, 'TradeMonitor');
      setLastUpdate(Date.now()); // Trigger refresh after monitoring starts
    } catch (error) {
      logService.log('error', `Failed to start monitoring for strategy: ${strategy.id}`, error, 'TradeMonitor');
      throw error;
    }
  };

  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

  
    let success = false;
    try {
      setError(null);
      setIsSubmittingBudget(true);
      const strategy = pendingStrategy;
      
      await tradeService.setBudget(strategy.id, budget);
      await updateStrategy(strategy.id, {
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      await marketService.startStrategyMonitoring(strategy);
      success = true;
      refresh();

      logService.log('info', `Strategy ${strategy.id} activated with budget`, { budget }, 'TradeMonitor');
    } catch (error) {
      logService.log('error', 'Failed to start strategy with budget', error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');
      if (pendingStrategy) {
        await tradeService.setBudget(pendingStrategy.id, null);
      }
    } finally {
      if (success) {
        setShowBudgetModal(false);
        setPendingStrategy(null);
        setError(null);
      }
      setIsSubmittingBudget(false);
      if (success) {
        setShowBudgetModal(false);
        setPendingStrategy(null);
        setError(null);
      }
    }
  };

  const handleStrategyDeactivate = async (strategyId: string) => {
    try {
      setDeactivatingStrategy(strategyId);
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy) throw new Error('Strategy not found');

      const trades = tradeManager.getActiveTradesForStrategy(strategyId);
      for (const trade of trades) {
        await tradeManager.closeTrade(trade.id);
      }

      await marketService.stopStrategyMonitoring(strategyId);
      await tradeService.setBudget(strategyId, null);
      await updateStrategy(strategyId, {
        status: 'inactive',
        updated_at: new Date().toISOString(),
      });

      updateMonitoringStatus(strategyId, 'idle', 'Strategy deactivated');
      refresh();
      logService.log('info', `Strategy ${strategyId} deactivated successfully`, null, 'TradeMonitor');
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${strategyId}`, error, 'TradeMonitor');
      setError('Failed to deactivate strategy. Please try again.');
    } finally {
      setDeactivatingStrategy(null);
    }
  };

  const handleStrategyActivate = async (strategy: Strategy) => {
    try {
      const budget = tradeService.getBudget(strategy.id);
      if (!budget) {
        setPendingStrategy(strategy);
        setShowBudgetModal(true);
        return;
      }

      await updateStrategy(strategy.id, {
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      await marketService.startStrategyMonitoring(strategy);
      updateMonitoringStatus(strategy.id, 'monitoring', 'Strategy activated, monitoring market conditions');
      refresh();
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${strategy.id}`, error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!monitoringInitialized) {
        await initializeMonitoring();
      }
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Filter and paginate strategies
  const filteredStrategies = strategies.filter(strategy => {
    const matchesSearch =
      strategy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      strategy.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredStrategies.length / itemsPerPage);
  const displayedStrategies = filteredStrategies.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const getMonitoringStatusColor = (status: string) => {
    switch (status) {
      case 'monitoring':
        return 'text-neon-turquoise';
      case 'generating':
        return 'text-neon-yellow';
      case 'executing':
        return 'text-neon-orange';
      default:
        return 'text-gray-400';
    }
  };

  const getMonitoringStatusIcon = (status: string) => {
    switch (status) {
      case 'monitoring':
        return <Activity className="w-4 h-4 text-neon-turquoise" />;
      case 'generating':
        return <Brain className="w-4 h-4 text-neon-yellow" />;
      case 'executing':
        return <Target className="w-4 h-4 text-neon-orange" />;
      default:
        return <Power className="w-4 h-4 text-gray-400" />;
    }
  };

  const IndicatorDisplay = ({ indicators }: { indicators: Record<string, number> }) => (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {Object.entries(indicators).map(([name, value]) => (
        <div key={name} className="bg-gunmetal-900/20 p-2 rounded-lg">
          <div className="text-xs text-gray-400">{name}</div>
          <div className="text-sm font-mono text-neon-yellow">{value.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );

  // FIXED: SignalDisplay now properly closes tags and separates trading conditions from trade details.
  const SignalDisplay = ({ signal }: { signal: TradeSignal }) => (
    <div className="bg-gunmetal-900/20 p-3 rounded-lg mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-neon-yellow" />
          <span className="text-sm font-medium text-neon-yellow">Trade Signal</span>
        </div>
        <span className="text-sm font-medium text-neon-yellow">
          Confidence: {(signal.confidence * 100).toFixed(1)}%
        </span>
      </div>
      
      {/* Progress Bar */}
      {monitoringStatus.get(signal.strategy_id)?.progress && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Signal Generation Progress</span>
            <span>{monitoringStatus.get(signal.strategy_id)?.progress}%</span>
          </div>
          <div className="h-1 bg-gunmetal-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-neon-yellow"
              initial={{ width: 0 }}
              animate={{ width: `${monitoringStatus.get(signal.strategy_id)?.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}
      
      {/* Trading Conditions */}
      {monitoringStatus.get(signal.strategy_id)?.conditions && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-gray-300 mb-2">Trading Conditions</h5>
          <div className="space-y-2">
            {monitoringStatus.get(signal.strategy_id)?.conditions.map((condition, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{condition.name}</span>
                <span className={condition.met ? 'text-neon-turquoise' : 'text-neon-pink'}>
                  {condition.value.toFixed(2)} / {condition.target.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Trade Details */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Direction:</span>
          <span className={signal.direction === 'Long' ? 'text-neon-turquoise' : 'text-neon-pink'}>
            {signal.direction}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Entry:</span>
          <span className="text-gray-200">${signal.entry_price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Stop Loss:</span>
          <span className="text-neon-pink">${signal.stop_loss.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Take Profit:</span>
          <span className="text-neon-turquoise">${signal.take_profit.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400">{signal.rationale}</div>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <PanelWrapper index={0}>
        <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-2">Trade Monitor</h2>
          <p className="text-sm text-gray-400">
            Monitor your active trades in real-time. Track positions, P&L, and market conditions.
          </p>
        </div>
      </PanelWrapper>

      {/* Controls */}
      <PanelWrapper index={1}>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search strategies..."
                className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-gunmetal-800 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded text-sm ${
                  statusFilter === 'all'
                    ? 'bg-neon-raspberry text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('profit')}
                className={`px-3 py-1 rounded text-sm ${
                  statusFilter === 'profit'
                    ? 'bg-neon-turquoise text-gunmetal-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Profit
              </button>
              <button
                onClick={() => setStatusFilter('loss')}
                className={`px-3 py-1 rounded text-sm ${
                  statusFilter === 'loss'
                    ? 'bg-neon-pink text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Loss
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </PanelWrapper>

      {/* Strategy List */}
      <PanelWrapper index={2}>
        <div className="space-y-4">
          {(loading || strategiesLoading) && !refreshing ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
            </div>
          ) : displayedStrategies.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
              <p className="text-xl text-gray-200 mb-2">
                {strategies.length === 0 ? 'No Strategies Found' : 'No Matching Strategies'}
              </p>
              <p className="text-gray-400">
                {strategies.length === 0 
                  ? 'Create a strategy to start trading' 
                  : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {displayedStrategies.map((strategy) => (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gunmetal-800/30 rounded-xl overflow-hidden"
                >
                  <div className="p-4 grid grid-cols-12 gap-6">
                    {/* Strategy Info - Left Side */}
                    <div className="col-span-7">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-200">{strategy.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-sm px-2 py-0.5 rounded-full ${
                                strategy.status === 'active'
                                  ? 'bg-neon-turquoise/20 text-neon-turquoise'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {strategy.status.toUpperCase()}
                            </span>
                            {monitoringStatus.get(strategy.id) && (
                              <div
                                className={`flex items-center gap-1 text-sm ${getMonitoringStatusColor(
                                  monitoringStatus.get(strategy.id)!.status
                                )}`}
                              >
                                {getMonitoringStatusIcon(monitoringStatus.get(strategy.id)!.status)}
                                <span>{monitoringStatus.get(strategy.id)!.message}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            strategy.status === 'active'
                              ? handleStrategyDeactivate(strategy.id)
                              : handleStrategyActivate(strategy)
                          }
                          disabled={deactivatingStrategy === strategy.id}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            strategy.status === 'active'
                              ? 'bg-neon-raspberry text-white hover:bg-opacity-90'
                              : 'bg-gunmetal-800 text-gray-200 hover:text-white'
                          }`}
                        >
                          {deactivatingStrategy === strategy.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : strategy.status === 'active' ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
                        </button>
                      </div>

                      {strategy.status === 'active' && (
                        <div className="space-y-4">
                          {/* Trading Parameters */}
                          <div className="bg-gunmetal-900/20 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Sliders className="w-4 h-4 text-neon-yellow" />
                              <h4 className="text-sm font-medium text-gray-200">Trading Parameters</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-gray-400">Leverage</p>
                                <p className="text-sm font-medium text-neon-yellow">
                                  {strategy.strategy_config?.trade_parameters?.leverage || 1}x
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Position Size</p>
                                <p className="text-sm font-medium text-neon-orange">
                                  {(strategy.strategy_config?.trade_parameters?.position_size || 0) * 100}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Confidence Threshold</p>
                                <p className="text-sm font-medium text-neon-turquoise">
                                  {(strategy.strategy_config?.trade_parameters?.confidence_factor || 0) * 100}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Timeframe</p>
                                <p className="text-sm font-medium text-neon-pink">
                                  {strategy.strategy_config?.timeframe || '1h'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Risk Management */}
                          <div className="bg-gunmetal-900/20 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Scale className="w-4 h-4 text-neon-orange" />
                              <h4 className="text-sm font-medium text-gray-200">Risk Management</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-gray-400">Stop Loss</p>
                                <p className="text-sm font-medium text-neon-pink">
                                  {strategy.strategy_config?.risk_management?.stop_loss || 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Take Profit</p>
                                <p className="text-sm font-medium text-neon-turquoise">
                                  {strategy.strategy_config?.risk_management?.take_profit || 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Trailing Stop</p>
                                <p className="text-sm font-medium text-neon-yellow">
                                  {strategy.strategy_config?.risk_management?.trailing_stop_loss || 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Max Drawdown</p>
                                <p className="text-sm font-medium text-neon-orange">
                                  {strategy.strategy_config?.risk_management?.max_drawdown || 0}%
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Trading Pairs */}
                          <div className="bg-gunmetal-900/20 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Coins className="w-4 h-4 text-neon-turquoise" />
                              <h4 className="text-sm font-medium text-gray-200">Trading Pairs</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {strategy.strategy_config?.assets?.map((asset: string) => (
                                <div
                                  key={asset}
                                  className="px-2 py-1 bg-gunmetal-800/50 rounded-lg text-sm text-neon-turquoise"
                                >
                                  {asset.replace('_', '/')}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Available Budget */}
                          <div className="bg-gunmetal-900/20 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Wallet className="w-4 h-4 text-neon-yellow" />
                              <h4 className="text-sm font-medium text-gray-200">Trading Budget</h4>
                            </div>
                            <BudgetControl strategy={strategy} onSave={refresh} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live Trades - Right Side */}
                    <div className="col-span-5 border-l border-gunmetal-700 pl-6">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-300">Live Trades</h5>
                        <span className="text-xs text-gray-400">
                          {tradeManager.getActiveTradesForStrategy(strategy.id).length} Active
                        </span>
                      </div>
                      {tradeManager.getActiveTradesForStrategy(strategy.id).length === 0 ? (
                        <div className="flex items-center justify-center h-24 bg-gunmetal-900/30 rounded-lg">
                          {strategy.status === 'active' ? (
                            <div className="text-center">
                              <Loader2 className="w-5 h-5 text-neon-yellow animate-spin mx-auto mb-2" />
                              <p className="text-sm text-gray-400">Monitoring for opportunities...</p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">No live trades</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tradeManager.getActiveTradesForStrategy(strategy.id).map((trade) => (
                            <div key={trade.id} className="bg-gunmetal-900/30 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-200">{trade.pair}</span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    trade.status === 'pending'
                                      ? 'bg-neon-yellow/20 text-neon-yellow'
                                      : 'bg-neon-turquoise/20 text-neon-turquoise'
                                  }`}
                                >
                                  {trade.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="text-gray-400">
                                  Amount: <span className="text-gray-200">{trade.amount}</span>
                                </div>
                                <div className="text-gray-400">
                                  Leverage:{' '}
                                  <span className="text-gray-200">
                                    {strategy.strategy_config?.trade_parameters?.leverage || 1}x
                                  </span>
                                </div>
                                <div className="text-gray-400">
                                  TP:{' '}
                                  <span className="text-neon-turquoise">
                                    $
                                    {(
                                      trade.entry_price *
                                      (1 + (strategy.strategy_config?.risk_management?.take_profit || 0) / 100)
                                    ).toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-gray-400">
                                  SL:{' '}
                                  <span className="text-neon-pink">
                                    $
                                    {(
                                      trade.entry_price *
                                      (1 - (strategy.strategy_config?.risk_management?.stop_loss || 0) / 100)
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-gunmetal-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">P&L</span>
                                  <span
                                    className={`text-sm font-medium ${
                                      trade.pnl >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                                    }`}
                                  >
                                    {trade.pnl >= 0 ? '+' : ''}
                                    {trade.pnl.toFixed(2)} USDT
                                    <span className="text-xs ml-1">
                                      ({trade.pnl_percent.toFixed(2)}%)
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {monitoringStatus.get(strategy.id)?.indicators && (
                        <IndicatorDisplay indicators={monitoringStatus.get(strategy.id)!.indicators!} />
                      )}
                      {monitoringStatus.get(strategy.id)?.signal && (
                        <SignalDisplay signal={monitoringStatus.get(strategy.id)!.signal!} />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1}
                className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </PanelWrapper>

      {showBudgetModal && pendingStrategy && (
        <BudgetModal
          onConfirm={handleBudgetConfirm}
          onCancel={() => {
            setError(null);
            setIsSubmittingBudget(false);
            setShowBudgetModal(false);
            setPendingStrategy(null);
          }}
          maxBudget={tradeService.calculateAvailableBudget()}
          riskLevel={pendingStrategy.risk_level}
          isSubmitting={isSubmittingBudget}
          error={error}
        />
      )}
    </div>
  );
}
