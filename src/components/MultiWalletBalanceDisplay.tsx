import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, ArrowDownRight, Briefcase, TrendingUp } from 'lucide-react';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { MultiWalletBalance } from '../lib/types';

interface MultiWalletBalanceDisplayProps {
  className?: string;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export function MultiWalletBalanceDisplay({ 
  className = '', 
  showRefreshButton = true,
  compact = false
}: MultiWalletBalanceDisplayProps) {
  const [multiWalletBalance, setMultiWalletBalance] = useState<MultiWalletBalance | null>(null);
  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'spot' | 'margin' | 'futures'>('spot');

  useEffect(() => {
    // Initialize balance data
    updateBalanceData();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      updateBalanceData();
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);
    walletBalanceService.on('multiWalletBalancesUpdated', handleBalanceUpdate);
    tradeService.on('budgetUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
      walletBalanceService.off('multiWalletBalancesUpdated', handleBalanceUpdate);
      tradeService.off('budgetUpdated', handleBalanceUpdate);
    };
  }, []);

  const updateBalanceData = () => {
    try {
      // Get multi-wallet balance
      const balance = walletBalanceService.getCurrentUserMultiWalletBalance();
      setMultiWalletBalance(balance);
      
      // Calculate allocated amount from trade service
      const allBudgets = tradeService.getAllBudgets();
      const totalAllocated = Array.from(allBudgets.values())
        .reduce((sum, budget) => sum + budget.allocated, 0);
      
      setAllocatedAmount(totalAllocated);
    } catch (error) {
      console.error('Failed to update balance data:', error);
      logService.log('error', 'Failed to update balance data', error, 'MultiWalletBalanceDisplay');
      // Set default values in case of error
      setMultiWalletBalance({
        spot: { free: 10000, used: 0, total: 10000, currency: 'USDT' },
        margin: { free: 5000, used: 1000, total: 6000, currency: 'USDT' },
        futures: { free: 8000, used: 2000, total: 10000, currency: 'USDT' },
        timestamp: Date.now()
      });
      setAllocatedAmount(0);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      await walletBalanceService.refreshBalances();
      // Update the balance data after refresh
      updateBalanceData();
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      logService.log('error', 'Failed to refresh balances', error, 'MultiWalletBalanceDisplay');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalBalance = (): number => {
    if (!multiWalletBalance) return 0;
    
    let total = 0;
    if (multiWalletBalance.spot) total += multiWalletBalance.spot.total;
    if (multiWalletBalance.margin) total += multiWalletBalance.margin.total;
    if (multiWalletBalance.futures) total += multiWalletBalance.futures.total;
    
    return total;
  };

  if (compact) {
    return (
      <div className={`bg-gunmetal-800/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-neon-turquoise" />
            <h3 className="text-sm font-medium text-gray-300">Total Balance</h3>
          </div>
          
          {showRefreshButton && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
              title="Refresh balance"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col">
          <p className="text-2xl font-bold text-neon-turquoise">
            ${getTotalBalance().toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          
          <div className="mt-2 flex items-center text-sm">
            <ArrowDownRight className="w-4 h-4 text-neon-pink" />
            <span className="text-neon-pink font-medium ml-1">
              ${allocatedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-gray-400 ml-2">outlaid in strategies</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gunmetal-800/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-neon-turquoise" />
          <h3 className="text-lg font-medium text-gray-200">Wallet Balances</h3>
        </div>
        
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-gunmetal-700 transition-colors"
            title="Refresh balance"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      
      {/* Wallet Type Tabs */}
      <div className="flex border-b border-gunmetal-700 mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'spot' ? 'text-neon-turquoise border-b-2 border-neon-turquoise' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('spot')}
        >
          Spot
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'margin' ? 'text-neon-yellow border-b-2 border-neon-yellow' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('margin')}
        >
          Margin
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'futures' ? 'text-neon-pink border-b-2 border-neon-pink' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('futures')}
        >
          Futures
        </button>
      </div>
      
      {/* Active Wallet Content */}
      <div className="space-y-4">
        {activeTab === 'spot' && multiWalletBalance?.spot && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Available</p>
                <p className="text-lg font-semibold text-neon-turquoise">
                  ${multiWalletBalance.spot.free.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-lg font-semibold text-gray-200">
                  ${multiWalletBalance.spot.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="bg-gunmetal-900/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">In Use</p>
              <div className="flex items-center">
                <p className="text-lg font-semibold text-neon-pink">
                  ${multiWalletBalance.spot.used.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-gray-400 ml-2">
                  ({((multiWalletBalance.spot.used / multiWalletBalance.spot.total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'margin' && multiWalletBalance?.margin && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Available</p>
                <p className="text-lg font-semibold text-neon-yellow">
                  ${multiWalletBalance.margin.free.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-lg font-semibold text-gray-200">
                  ${multiWalletBalance.margin.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="bg-gunmetal-900/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">In Use</p>
              <div className="flex items-center">
                <p className="text-lg font-semibold text-neon-pink">
                  ${multiWalletBalance.margin.used.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-gray-400 ml-2">
                  ({((multiWalletBalance.margin.used / multiWalletBalance.margin.total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'futures' && multiWalletBalance?.futures && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Available</p>
                <p className="text-lg font-semibold text-neon-pink">
                  ${multiWalletBalance.futures.free.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-lg font-semibold text-gray-200">
                  ${multiWalletBalance.futures.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="bg-gunmetal-900/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">In Use</p>
              <div className="flex items-center">
                <p className="text-lg font-semibold text-neon-pink">
                  ${multiWalletBalance.futures.used.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-gray-400 ml-2">
                  ({((multiWalletBalance.futures.used / multiWalletBalance.futures.total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </>
        )}
        
        <div className="mt-4 pt-4 border-t border-gunmetal-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Total Balance:</p>
            <p className="text-lg font-bold text-gray-200">
              ${getTotalBalance().toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-400">Outlaid in Strategies:</p>
            <p className="text-lg font-medium text-neon-pink">
              ${allocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
