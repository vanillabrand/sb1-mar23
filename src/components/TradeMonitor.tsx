import React, { useEffect, useState } from 'react';
import { 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Search 
} from 'lucide-react';
import { 
  marketService,
  tradeService, 
  monitoringService,
  logService 
} from '../lib/services';
import { 
  TradeChart,
  TradeStats, 
  TradeList,
  AssetPairMonitor,
  BudgetModal,
  PanelWrapper 
} from './index';
import type { 
  Trade, 
  MarketData, 
  Strategy, 
  StrategyBudget,
  TradeStats as TradeStatsType 
} from '../lib/types';

interface TradeMonitorProps {
  strategies?: Strategy[];
}

export const TradeMonitor: React.FC<TradeMonitorProps> = ({ strategies = [] }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [tradeStats, setTradeStats] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;
    const unsubscribers: (() => void)[] = [];

    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        // Subscribe to market data updates
        const unsubMarket = marketService.subscribe((data) => {
          if (mounted) setMarketData(data);
        });
        unsubscribers.push(unsubMarket);

        // Subscribe to trade updates
        const unsubTrades = tradeService.subscribe((updatedTrades) => {
          if (mounted) {
            setTrades(updatedTrades);
            updateTradeStats(updatedTrades);
          }
        });
        unsubscribers.push(unsubTrades);

        if (mounted) setIsLoading(false);
      } catch (error) {
        logService.log('error', 'Failed to initialize trade monitoring', error, 'TradeMonitor');
        if (mounted) {
          setError('Failed to initialize monitoring');
          setIsLoading(false);
        }
      }
    };

    initializeData();

    // Cleanup subscriptions
    return () => {
      mounted = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const updateTradeStats = (currentTrades: Trade[]) => {
    const stats = {
      totalTrades: currentTrades.length,
      profitableTrades: currentTrades.filter(t => t.profit > 0).length,
      totalProfit: currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
      averageProfit: currentTrades.length ? 
        currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / currentTrades.length : 
        0
    };
    setTradeStats(stats);
  };

  const refresh = async () => {
    if (refreshing) return;
    
    try {
      setRefreshing(true);
      await Promise.all([
        marketService.refresh(),
        tradeService.refresh()
      ]);
    } catch (error) {
      logService.log('error', 'Failed to refresh data', error, 'TradeMonitor');
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

    let success = false;
    try {
      setError(null);
      const strategy = pendingStrategy;
      
      await tradeService.setBudget(strategy.id, budget);
      
      await monitoringService.updateStrategy(strategy.id, {
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
      }
    }
  };

  const filteredTrades = trades
    .filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true :
        statusFilter === 'profit' ? trade.profit > 0 : trade.profit < 0;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <PanelWrapper>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">Trade Monitor</h1>
              <button
                onClick={refresh}
                className="px-4 py-2 bg-neon-blue text-white rounded-md hover:bg-blue-600 transition-colors"
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-md p-4 text-red-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <TradeChart trades={filteredTrades} />
              </div>
              <div>
                <TradeStats stats={tradeStats} />
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search trades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gunmetal-800 rounded-lg text-white"
                  />
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-4 py-2 bg-gunmetal-800 rounded-lg text-white"
              >
                <option value="all">All Trades</option>
                <option value="profit">Profitable</option>
                <option value="loss">Loss</option>
              </select>
            </div>

            <TradeList 
              trades={filteredTrades}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />

            {selectedStrategy && (
              <AssetPairMonitor
                strategy={selectedStrategy}
                onTradeSignal={(signal) => {
                  // Handle trade signal
                }}
              />
            )}

            {showBudgetModal && pendingStrategy && (
              <BudgetModal
                strategy={pendingStrategy}
                onConfirm={handleBudgetConfirm}
                onClose={() => {
                  setShowBudgetModal(false);
                  setPendingStrategy(null);
                }}
              />
            )}
          </>
        )}
      </div>
    </PanelWrapper>
  );
};
