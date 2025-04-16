import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { exchangeService } from '../lib/exchange-service';
import { WalletBalance, MarketType } from '../lib/types';
import { logService } from '../lib/log-service';
import AvailableBalanceDisplay from './AvailableBalanceDisplay';

interface MarketTypeBalanceDisplayProps {
  compact?: boolean;
  showRefreshButton?: boolean;
  className?: string;
}

const MarketTypeBalanceDisplay: React.FC<MarketTypeBalanceDisplayProps> = ({
  compact = false,
  showRefreshButton = true,
  className = ''
}) => {
  const [balances, setBalances] = useState<{
    spot?: WalletBalance;
    margin?: WalletBalance;
    futures?: WalletBalance;
  }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketTypes] = useState<MarketType[]>(['spot', 'margin', 'futures']);

  useEffect(() => {
    // Fetch balances on component mount
    fetchBalances();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      fetchBalances();
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
    };
  }, []);

  const fetchBalances = async () => {
    try {
      setIsRefreshing(true);
      const marketBalances = await exchangeService.fetchAllWalletBalances();
      setBalances(marketBalances);
      logService.log('info', 'Fetched market type balances', marketBalances, 'MarketTypeBalanceDisplay');
    } catch (error) {
      logService.log('error', 'Failed to fetch market type balances', error, 'MarketTypeBalanceDisplay');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchBalances();
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        {marketTypes.map(marketType => (
          <AvailableBalanceDisplay
            key={marketType}
            marketType={marketType}
            compact
            showRefreshButton={false}
            showLabel={true}
          />
        ))}
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
        <h3 className="text-sm font-medium text-white">Wallet Balances</h3>
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

      <div className="space-y-3">
        {marketTypes.map(marketType => (
          <div key={marketType} className="flex items-center justify-between">
            <span className="text-sm text-gray-400 capitalize">{marketType}:</span>
            <AvailableBalanceDisplay
              marketType={marketType}
              compact
              showRefreshButton={false}
              showLabel={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketTypeBalanceDisplay;
