import React, { useState, useEffect } from 'react';
import { RefreshCw, DollarSign } from 'lucide-react';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { exchangeService } from '../lib/exchange-service';
import { WalletBalance, MarketType } from '../lib/types';
import { logService } from '../lib/log-service';

interface AvailableBalanceDisplayProps {
  marketType?: MarketType;
  compact?: boolean;
  showRefreshButton?: boolean;
  className?: string;
  showLabel?: boolean;
}

const AvailableBalanceDisplay: React.FC<AvailableBalanceDisplayProps> = ({
  marketType = 'spot',
  compact = false,
  showRefreshButton = true,
  className = '',
  showLabel = true
}) => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Fetch balance on component mount
    fetchBalance();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      fetchBalance();
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
    };
  }, [marketType]);

  const fetchBalance = async () => {
    try {
      setIsRefreshing(true);
      const marketBalances = await exchangeService.fetchAllWalletBalances();
      const marketBalance = marketBalances[marketType];
      
      if (marketBalance) {
        setBalance(marketBalance);
      } else {
        // Fallback to general available balance
        const generalBalance = walletBalanceService.getBalance();
        setBalance(generalBalance);
      }
      
      logService.log('info', `Fetched ${marketType} balance`, marketBalance || generalBalance, 'AvailableBalanceDisplay');
    } catch (error) {
      logService.log('error', 'Failed to fetch market balance', error, 'AvailableBalanceDisplay');
      // Fallback to general available balance
      const generalBalance = walletBalanceService.getBalance();
      setBalance(generalBalance);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchBalance();
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-xs text-gray-400 capitalize">{marketType}:</span>
        )}
        <span className="text-sm font-medium text-white">
          ${balance?.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
        </span>
        {showRefreshButton && (
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gunmetal-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-white">
            {showLabel ? `Available Balance (${marketType.charAt(0).toUpperCase() + marketType.slice(1)})` : 'Available Balance'}
          </h3>
        </div>
        {showRefreshButton && (
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      
      <div className="flex items-center">
        <span className="text-2xl font-bold text-neon-turquoise">
          ${balance?.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
        </span>
        <span className="ml-2 text-xs text-gray-400">
          USDT
        </span>
      </div>
      
      {balance && (
        <div className="mt-2">
          <div className="w-full bg-gunmetal-700 h-1 rounded-full">
            <div 
              className="bg-gradient-to-r from-neon-turquoise to-neon-yellow h-1 rounded-full" 
              style={{ width: `${Math.min(100, (balance.free / balance.total) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>Used: ${balance.used.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>Total: ${balance.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableBalanceDisplay;
