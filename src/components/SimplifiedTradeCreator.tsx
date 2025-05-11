import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowDownUp, DollarSign, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { Strategy } from '../types';
import { tradeService } from '../lib/trade-service';
import { unifiedTradeService } from '../lib/unified-trade-service';
import { demoService } from '../lib/demo-service';
import { logService } from '../lib/log-service';
import { marketDataService } from '../lib/market-data-service';

interface SimplifiedTradeCreatorProps {
  strategy: Strategy;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SimplifiedTradeCreator({ 
  strategy, 
  onSuccess, 
  onCancel 
}: SimplifiedTradeCreatorProps) {
  // Form state
  const [symbol, setSymbol] = useState<string>('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [budget, setBudget] = useState<number>(0);
  
  // Demo mode
  const isDemoMode = demoService.isDemoMode();

  // Load available trading pairs and budget
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get available pairs
        const pairs = await marketDataService.getAvailablePairs();
        setAvailablePairs(pairs);
        
        // Set default symbol if strategy has selected pairs
        if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
          setSymbol(strategy.selected_pairs[0]);
        } else if (pairs.length > 0) {
          setSymbol(pairs[0]);
        }
        
        // Get budget
        const strategyBudget = tradeService.getBudget(strategy.id);
        if (strategyBudget) {
          setBudget(strategyBudget.available);
        }
      } catch (error) {
        logService.log('error', 'Failed to load initial data', error, 'SimplifiedTradeCreator');
        setError('Failed to load trading pairs. Please try again.');
      }
    };
    
    loadInitialData();
  }, [strategy]);
  
  // Fetch price when symbol changes
  useEffect(() => {
    if (!symbol) return;
    
    const fetchPrice = async () => {
      try {
        setIsLoadingPrice(true);
        const price = await marketDataService.getCurrentPrice(symbol);
        setCurrentPrice(price);
        
        // Set default amount to 10% of available budget
        if (budget > 0 && price > 0) {
          const defaultAmount = (budget * 0.1) / price;
          setAmount(parseFloat(defaultAmount.toFixed(6)));
        }
      } catch (error) {
        logService.log('error', `Failed to fetch price for ${symbol}`, error, 'SimplifiedTradeCreator');
        setCurrentPrice(null);
      } finally {
        setIsLoadingPrice(false);
      }
    };
    
    fetchPrice();
  }, [symbol, budget]);
  
  // Handle symbol change
  const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSymbol(e.target.value);
  };
  
  // Handle side change
  const handleSideChange = (newSide: 'buy' | 'sell') => {
    setSide(newSide);
  };
  
  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setAmount(value);
    }
  };
  
  // Handle percentage buttons
  const handlePercentageClick = (percentage: number) => {
    if (budget > 0 && currentPrice && currentPrice > 0) {
      const calculatedAmount = (budget * percentage) / currentPrice;
      setAmount(parseFloat(calculatedAmount.toFixed(6)));
    }
  };
  
  // Calculate total cost
  const calculateTotalCost = (): number => {
    if (!currentPrice || !amount) return 0;
    return currentPrice * amount;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate inputs
      if (!symbol) {
        throw new Error('Please select a trading pair');
      }
      
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      const totalCost = calculateTotalCost();
      
      if (totalCost > budget) {
        throw new Error('Trade cost exceeds available budget');
      }
      
      // Create trade options
      const tradeOptions = {
        strategy_id: strategy.id,
        symbol: symbol,
        side: side,
        quantity: amount,
        price: currentPrice,
        entry_price: currentPrice,
        stop_loss: currentPrice * (side === 'buy' ? 0.95 : 1.05), // 5% stop loss
        take_profit: currentPrice * (side === 'buy' ? 1.1 : 0.9), // 10% take profit
        trailing_stop: 2.5, // 2.5% trailing stop
        market_type: strategy.market_type || strategy.marketType || 'spot',
        marginType: strategy.market_type === 'futures' ? 'cross' : undefined,
        leverage: strategy.market_type === 'futures' ? 2 : undefined,
        rationale: 'Trade created using simplified trade creator',
        entry_conditions: ['Manual entry'],
        exit_conditions: ['Take profit', 'Stop loss', 'Trailing stop']
      };
      
      // Create the trade
      await unifiedTradeService.createTrade(tradeOptions);
      
      // Success
      setIsSubmitting(false);
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create trade');
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl">
      <h2 className="text-xl font-bold gradient-text mb-4">
        Create New Trade
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Trading Pair */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trading Pair
          </label>
          <select
            value={symbol}
            onChange={handleSymbolChange}
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
            disabled={isSubmitting}
          >
            {availablePairs.map((pair) => (
              <option key={pair} value={pair}>
                {pair}
              </option>
            ))}
          </select>
        </div>
        
        {/* Current Price */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Current Price
          </label>
          <div className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200">
            {isLoadingPrice ? (
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : currentPrice ? (
              <span>${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            ) : (
              <span className="text-gray-400">Price unavailable</span>
            )}
          </div>
        </div>
        
        {/* Trade Side */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trade Side
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSideChange('buy')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border ${
                side === 'buy'
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'bg-gunmetal-800 border-gunmetal-700 text-gray-400 hover:bg-gunmetal-700'
              }`}
              disabled={isSubmitting}
            >
              <TrendingUp className="w-4 h-4" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => handleSideChange('sell')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border ${
                side === 'sell'
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-gunmetal-800 border-gunmetal-700 text-gray-400 hover:bg-gunmetal-700'
              }`}
              disabled={isSubmitting}
            >
              <TrendingDown className="w-4 h-4" />
              Sell
            </button>
          </div>
        </div>
        
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              min={0}
              step="0.000001"
              disabled={isSubmitting}
            />
          </div>
          
          {/* Percentage buttons */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[0.25, 0.5, 0.75, 1].map((percentage) => (
              <button
                key={percentage}
                type="button"
                onClick={() => handlePercentageClick(percentage)}
                className="py-1 px-2 bg-gunmetal-800 hover:bg-gunmetal-700 text-gray-300 text-xs rounded"
                disabled={isSubmitting}
              >
                {percentage * 100}%
              </button>
            ))}
          </div>
          
          <p className="mt-1 text-sm text-gray-400">
            Available: ${budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {isDemoMode && <span className="ml-2 text-neon-turquoise">(Demo)</span>}
          </p>
        </div>
        
        {/* Total Cost */}
        <div className="bg-gunmetal-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Cost:</span>
            <span className="text-white font-medium">
              ${calculateTotalCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        {/* Submit buttons */}
        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50"
            disabled={isSubmitting || !currentPrice || amount <= 0}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </div>
            ) : (
              'Create Trade'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
