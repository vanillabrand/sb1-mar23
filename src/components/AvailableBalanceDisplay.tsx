import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, ArrowDownRight } from 'lucide-react';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';

interface AvailableBalanceDisplayProps {
  className?: string;
  showRefreshButton?: boolean;
}

export function AvailableBalanceDisplay({
  className = '',
  showRefreshButton = true
}: AvailableBalanceDisplayProps) {
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Initialize balance data
    updateBalanceData();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      updateBalanceData();
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);
    tradeService.on('budgetUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
      tradeService.off('budgetUpdated', handleBalanceUpdate);
    };
  }, []);

  const updateBalanceData = () => {
    try {
      // Get available balance from wallet service
      const walletAvailable = walletBalanceService.getAvailableBalance();
      const walletTotal = walletBalanceService.getTotalBalance();

      // Calculate allocated amount from trade service
      const allBudgets = tradeService.getAllBudgets();
      const totalAllocated = Array.from(allBudgets.values())
        .reduce((sum, budget) => sum + budget.allocated, 0);

      setAvailableBalance(walletAvailable);
      setTotalBalance(walletTotal);
      setAllocatedAmount(totalAllocated);
    } catch (error) {
      console.error('Failed to update balance data:', error);
      logService.log('error', 'Failed to update balance data', error, 'AvailableBalanceDisplay');
      // Set default values in case of error
      setAvailableBalance(10000);
      setTotalBalance(10000);
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
      logService.log('error', 'Failed to refresh balances', error, 'AvailableBalanceDisplay');
      // Set default values in case of error
      setAvailableBalance(10000);
      setTotalBalance(10000);
      setAllocatedAmount(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-gunmetal-800/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-gray-300">Available Balance</h3>
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
          ${availableBalance.toLocaleString(undefined, {
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
