import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertCircle, 
  ArrowDownUp, 
  DollarSign, 
  Loader2, 
  TrendingDown, 
  TrendingUp,
  X,
  Check
} from 'lucide-react';
import { Strategy } from '../../lib/types';
import { tradeService } from '../../lib/trade-service';
import { unifiedTradeService } from '../../lib/unified-trade-service';
import { demoService } from '../../lib/demo-service';
import { logService } from '../../lib/log-service';
import { marketDataService } from '../../lib/market-data-service';
import { marketService } from '../../lib/market-service';

interface SimplifiedTradeCreatorProps {
  strategies: Strategy[];
  onComplete: () => void;
  onCancel: () => void;
}

export function SimplifiedTradeCreator({ 
  strategies, 
  onComplete, 
  onCancel 
}: SimplifiedTradeCreatorProps) {
  // Form state
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [symbol, setSymbol] = useState<string>('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [takeProfit, setTakeProfit] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [budget, setBudget] = useState<number>(0);
  const [maxAmount, setMaxAmount] = useState<number>(0);
  
  // Demo mode
  const isDemoMode = demoService.isDemoMode();
  
  // Set default strategy if only one is available
  useEffect(() => {
    if (strategies.length === 1) {
      setSelectedStrategy(strategies[0]);
    }
  }, [strategies]);
  
  // Load available pairs when strategy changes
  useEffect(() => {
    if (selectedStrategy) {
      loadAvailablePairs();
      loadBudget();
    }
  }, [selectedStrategy]);
  
  // Load current price when symbol changes
  useEffect(() => {
    if (symbol) {
      loadCurrentPrice();
    }
  }, [symbol]);
  
  // Update stop loss and take profit when price or side changes
  useEffect(() => {
    if (currentPrice) {
      // Default stop loss: 5% below entry for buy, 5% above for sell
      const defaultStopLoss = side === 'buy' 
        ? currentPrice * 0.95 
        : currentPrice * 1.05;
      
      // Default take profit: 10% above entry for buy, 10% below for sell
      const defaultTakeProfit = side === 'buy' 
        ? currentPrice * 1.1 
        : currentPrice * 0.9;
      
      setStopLoss(parseFloat(defaultStopLoss.toFixed(2)));
      setTakeProfit(parseFloat(defaultTakeProfit.toFixed(2)));
    }
  }, [currentPrice, side]);
  
  // Update max amount when price or budget changes
  useEffect(() => {
    if (currentPrice && budget > 0) {
      // Max amount is 90% of available budget divided by current price
      const max = (budget * 0.9) / currentPrice;
      setMaxAmount(parseFloat(max.toFixed(6)));
    }
  }, [currentPrice, budget]);
  
  // Load available trading pairs
  const loadAvailablePairs = async () => {
    try {
      if (!selectedStrategy) return;
      
      // First try to get pairs from the strategy
      if (selectedStrategy.selected_pairs && selectedStrategy.selected_pairs.length > 0) {
        setAvailablePairs(selectedStrategy.selected_pairs);
        // Set default symbol to first pair
        setSymbol(selectedStrategy.selected_pairs[0]);
        return;
      }
      
      // Fallback to getting all available pairs
      const pairs = await marketService.getAvailablePairs();
      setAvailablePairs(pairs);
      
      // Set default symbol to first pair
      if (pairs.length > 0) {
        setSymbol(pairs[0]);
      }
    } catch (err) {
      logService.log('error', 'Failed to load available pairs', err, 'SimplifiedTradeCreator');
    }
  };
  
  // Load current price for selected symbol
  const loadCurrentPrice = async () => {
    try {
      setIsLoadingPrice(true);
      
      // Format symbol for market data service (replace _ with /)
      const formattedSymbol = symbol.replace('_', '/');
      
      // Get current price
      const price = await marketDataService.getCurrentPrice(formattedSymbol);
      setCurrentPrice(price);
      
      setIsLoadingPrice(false);
    } catch (err) {
      setIsLoadingPrice(false);
      logService.log('error', `Failed to load current price for ${symbol}`, err, 'SimplifiedTradeCreator');
    }
  };
  
  // Load budget for selected strategy
  const loadBudget = async () => {
    try {
      if (!selectedStrategy) return;
      
      // Get budget for strategy
      const strategyBudget = await tradeService.getBudget(selectedStrategy.id);
      
      // Set available budget
      setBudget(strategyBudget?.available || 0);
    } catch (err) {
      logService.log('error', `Failed to load budget for strategy ${selectedStrategy?.id}`, err, 'SimplifiedTradeCreator');
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
      if (!selectedStrategy) {
        throw new Error('Please select a strategy');
      }
      
      if (!symbol) {
        throw new Error('Please select a trading pair');
      }
      
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      if (!currentPrice) {
        throw new Error('Failed to get current price');
      }
      
      const totalCost = calculateTotalCost();
      
      if (totalCost > budget) {
        throw new Error('Trade cost exceeds available budget');
      }
      
      // Create trade options
      const tradeOptions = {
        strategy_id: selectedStrategy.id,
        symbol: symbol,
        side: side,
        quantity: amount,
        price: currentPrice,
        entry_price: currentPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        trailing_stop: 2.5, // 2.5% trailing stop
        market_type: selectedStrategy.market_type || selectedStrategy.marketType || 'spot',
        marginType: selectedStrategy.market_type === 'futures' ? 'cross' : undefined,
        leverage: selectedStrategy.market_type === 'futures' ? 2 : undefined,
        rationale: 'Trade created using simplified trade creator',
        entry_conditions: ['Manual entry'],
        exit_conditions: ['Take profit', 'Stop loss', 'Trailing stop']
      };
      
      // Create the trade
      await unifiedTradeService.createTrade(tradeOptions);
      
      // Success
      setIsSubmitting(false);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create trade');
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">
            Create New Trade
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <p>{error}</p>
          </div>
        )}
        
        {/* Demo Mode Indicator */}
        {isDemoMode && (
          <div className="mb-4 p-3 bg-neon-yellow/10 border border-neon-yellow/20 text-neon-yellow rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <p>Demo Mode: This trade will be simulated and won't use real funds.</p>
          </div>
        )}
        
        {/* Trade Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Strategy Selection */}
          <div>
            <label htmlFor="strategy" className="block text-sm font-medium text-gray-300 mb-1">
              Strategy
            </label>
            <select
              id="strategy"
              value={selectedStrategy?.id || ''}
              onChange={(e) => {
                const strategy = strategies.find(s => s.id === e.target.value);
                setSelectedStrategy(strategy || null);
              }}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
              required
            >
              <option value="">Select a strategy</option>
              {strategies.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} ({strategy.market_type || strategy.marketType || 'spot'})
                </option>
              ))}
            </select>
          </div>
          
          {/* Trading Pair */}
          <div>
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-300 mb-1">
              Trading Pair
            </label>
            <select
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
              required
              disabled={!selectedStrategy}
            >
              <option value="">Select a trading pair</option>
              {availablePairs.map(pair => (
                <option key={pair} value={pair}>
                  {pair.replace('_', '/')}
                </option>
              ))}
            </select>
          </div>
          
          {/* Current Price */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Current Price
            </label>
            <div className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200">
              {isLoadingPrice ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span>Loading...</span>
                </div>
              ) : currentPrice ? (
                <span>${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              ) : (
                <span className="text-gray-400">Select a trading pair</span>
              )}
            </div>
          </div>
          
          {/* Trade Side */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Trade Side
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={`p-3 rounded-lg flex items-center justify-center gap-2 ${
                  side === 'buy' 
                    ? 'bg-neon-turquoise/20 text-neon-turquoise border border-neon-turquoise/30' 
                    : 'bg-gunmetal-800 text-gray-400 border border-gunmetal-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Buy (Long)
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={`p-3 rounded-lg flex items-center justify-center gap-2 ${
                  side === 'sell' 
                    ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30' 
                    : 'bg-gunmetal-800 text-gray-400 border border-gunmetal-700'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Sell (Short)
              </button>
            </div>
          </div>
          
          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              id="amount"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              step="0.000001"
              min="0"
              max={maxAmount}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
              required
            />
            {maxAmount > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">Max: {maxAmount.toFixed(6)}</span>
                <button
                  type="button"
                  onClick={() => setAmount(maxAmount)}
                  className="text-xs text-neon-turquoise hover:underline"
                >
                  Use Max
                </button>
              </div>
            )}
          </div>
          
          {/* Total Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Total Cost
            </label>
            <div className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200">
              ${calculateTotalCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {budget > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Available Budget: ${budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedStrategy || !symbol || !amount || !currentPrice || calculateTotalCost() > budget}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Trade...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Trade
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
