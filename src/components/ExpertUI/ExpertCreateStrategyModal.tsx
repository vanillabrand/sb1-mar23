import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  ChevronRight, 
  AlertTriangle, 
  Check,
  Code,
  Terminal,
  Sliders,
  Layers,
  Wallet,
  Shield,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { strategyService } from '../../lib/strategy-service';
import { logService } from '../../lib/log-service';
import { Strategy } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/enhanced-supabase';
import { ExpertCodeEditor } from './ExpertCodeEditor';

interface ExpertCreateStrategyModalProps {
  onClose: () => void;
  onStrategyCreated: (strategy: Strategy) => void;
}

export function ExpertCreateStrategyModal({ onClose, onStrategyCreated }: ExpertCreateStrategyModalProps) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'code'>('basic');
  
  // Strategy data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [marketType, setMarketType] = useState<'spot' | 'margin' | 'futures'>('spot');
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [budget, setBudget] = useState(100);
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [trailingStop, setTrailingStop] = useState(false);
  const [trailingStopDistance, setTrailingStopDistance] = useState(2);
  const [maxDrawdown, setMaxDrawdown] = useState(15);
  const [maxOpenTrades, setMaxOpenTrades] = useState(3);
  const [timeframe, setTimeframe] = useState('1h');
  const [strategyCode, setStrategyCode] = useState('');
  
  // Load available pairs
  useEffect(() => {
    const loadAvailablePairs = async () => {
      try {
        // In a real implementation, this would fetch from the exchange service
        // For now, we'll use a static list of common pairs
        setAvailablePairs([
          'BTC/USDT',
          'ETH/USDT',
          'BNB/USDT',
          'SOL/USDT',
          'ADA/USDT',
          'XRP/USDT',
          'DOT/USDT',
          'DOGE/USDT',
          'AVAX/USDT',
          'MATIC/USDT',
          'LINK/USDT',
          'UNI/USDT',
          'ATOM/USDT',
          'LTC/USDT',
          'BCH/USDT',
          'ALGO/USDT',
          'XLM/USDT',
          'VET/USDT',
          'FIL/USDT',
          'TRX/USDT'
        ]);
        
        // Set default strategy code
        setStrategyCode(`// Advanced Strategy Configuration
// This code will be executed to determine trade signals

function initialize() {
  // Called once when strategy is created
  // Set up any initial state or configuration
  return {
    name: "${title || 'My Expert Strategy'}",
    description: "${description || 'Custom trading strategy with advanced parameters'}",
    version: "1.0.0",
    author: "${user?.email || 'Anonymous'}"
  };
}

function onTick(data, state) {
  // Called on each price update
  // data contains current market data
  // state contains strategy state
  
  // Example: Simple moving average crossover
  const shortMA = calculateSMA(data.closes, 10);
  const longMA = calculateSMA(data.closes, 30);
  
  if (shortMA > longMA) {
    return { signal: "BUY", confidence: 0.7 };
  } else if (shortMA < longMA) {
    return { signal: "SELL", confidence: 0.7 };
  }
  
  return { signal: "NEUTRAL", confidence: 0.5 };
}

// Helper functions
function calculateSMA(values, period) {
  if (values.length < period) return null;
  const sum = values.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// Export the strategy functions
export default {
  initialize,
  onTick
};`);
      } catch (error) {
        logService.log('error', 'Failed to load available pairs', error, 'ExpertCreateStrategyModal');
        setError('Failed to load available pairs. Please try again.');
      }
    };
    
    loadAvailablePairs();
  }, [user?.email, title, description]);
  
  // Handle create strategy
  const handleCreateStrategy = async () => {
    if (!user) {
      setError('You must be logged in to create a strategy');
      return;
    }
    
    if (!title.trim()) {
      setError('Please enter a strategy name');
      return;
    }
    
    if (selectedPairs.length === 0) {
      setError('Please select at least one trading pair');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      // Format pairs to match the expected format
      const formattedPairs = selectedPairs.map(pair => pair.replace('/', '_'));
      
      // Create a strategy object with advanced parameters
      const strategyData = {
        id: uuidv4(),
        title: title.trim(),
        name: title.trim(),
        description: description.trim() || '',
        user_id: user.id,
        status: 'inactive',
        risk_level: riskLevel,
        riskLevel: riskLevel,
        market_type: marketType,
        marketType: marketType,
        selected_pairs: formattedPairs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type: 'custom',
        parameters: {
          leverage: leverage,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          trailingStop: trailingStop,
          trailingStopDistance: trailingStopDistance,
          maxDrawdown: maxDrawdown,
          maxOpenTrades: maxOpenTrades,
          timeframe: timeframe
        },
        code: activeTab === 'code' ? strategyCode : null
      };
      
      // Insert the strategy into the database
      const { data: newStrategy, error } = await supabase
        .from('strategies')
        .insert(strategyData)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Set the budget for the strategy
      if (newStrategy) {
        await strategyService.setBudget(newStrategy.id, budget);
      }
      
      // Call the onStrategyCreated callback with the new strategy
      onStrategyCreated(newStrategy);
      
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'ExpertCreateStrategyModal');
      setError('Failed to create strategy. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl mx-4 panel-metallic rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gunmetal-800">
          <h2 className="text-xl font-bold">Create Advanced Strategy</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gunmetal-800 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gunmetal-800">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'basic' 
                ? 'text-neon-turquoise border-b-2 border-neon-turquoise' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Basic Settings
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'advanced' 
                ? 'text-neon-turquoise border-b-2 border-neon-turquoise' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Advanced Parameters
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'code' 
                ? 'text-neon-turquoise border-b-2 border-neon-turquoise' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Strategy Code
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                  Strategy Name
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Expert Strategy"
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of your strategy..."
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent h-24 resize-none"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Risk Level
                  </label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as any)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  >
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Market Type
                  </label>
                  <select
                    value={marketType}
                    onChange={(e) => setMarketType(e.target.value as any)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  >
                    <option value="spot">Spot</option>
                    <option value="margin">Margin</option>
                    <option value="futures">Futures</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Trading Pairs
                </label>
                <div className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availablePairs.map(pair => (
                      <div key={pair} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`pair-${pair}`}
                          checked={selectedPairs.includes(pair)}
                          onChange={() => {
                            if (selectedPairs.includes(pair)) {
                              setSelectedPairs(selectedPairs.filter(p => p !== pair));
                            } else {
                              setSelectedPairs([...selectedPairs, pair]);
                            }
                          }}
                          className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise focus:ring-offset-gunmetal-800"
                        />
                        <label htmlFor={`pair-${pair}`} className="ml-2 text-sm text-gray-300">
                          {pair}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-gray-300 mb-1">
                  Budget (USDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    id="budget"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    min="10"
                    step="10"
                    className="w-full pl-8 pr-4 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                  />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="leverage" className="block text-sm font-medium text-gray-300 mb-1">
                    Leverage
                  </label>
                  <div className="relative">
                    <input
                      id="leverage"
                      type="number"
                      value={leverage}
                      onChange={(e) => setLeverage(Number(e.target.value))}
                      min="1"
                      max="100"
                      step="1"
                      className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">x</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Only applies to margin and futures trading
                  </p>
                </div>
                
                <div>
                  <label htmlFor="timeframe" className="block text-sm font-medium text-gray-300 mb-1">
                    Timeframe
                  </label>
                  <select
                    id="timeframe"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  >
                    <option value="1m">1 minute</option>
                    <option value="5m">5 minutes</option>
                    <option value="15m">15 minutes</option>
                    <option value="30m">30 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="4h">4 hours</option>
                    <option value="1d">1 day</option>
                    <option value="1w">1 week</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stopLoss" className="block text-sm font-medium text-gray-300 mb-1">
                    Stop Loss (%)
                  </label>
                  <div className="relative">
                    <input
                      id="stopLoss"
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(Number(e.target.value))}
                      min="0.1"
                      max="50"
                      step="0.1"
                      className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="takeProfit" className="block text-sm font-medium text-gray-300 mb-1">
                    Take Profit (%)
                  </label>
                  <div className="relative">
                    <input
                      id="takeProfit"
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(Number(e.target.value))}
                      min="0.1"
                      max="100"
                      step="0.1"
                      className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  id="trailingStop"
                  type="checkbox"
                  checked={trailingStop}
                  onChange={(e) => setTrailingStop(e.target.checked)}
                  className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise focus:ring-offset-gunmetal-800"
                />
                <label htmlFor="trailingStop" className="ml-2 text-sm text-gray-300">
                  Enable Trailing Stop
                </label>
              </div>
              
              {trailingStop && (
                <div>
                  <label htmlFor="trailingStopDistance" className="block text-sm font-medium text-gray-300 mb-1">
                    Trailing Stop Distance (%)
                  </label>
                  <div className="relative">
                    <input
                      id="trailingStopDistance"
                      type="number"
                      value={trailingStopDistance}
                      onChange={(e) => setTrailingStopDistance(Number(e.target.value))}
                      min="0.1"
                      max="20"
                      step="0.1"
                      className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="maxDrawdown" className="block text-sm font-medium text-gray-300 mb-1">
                    Max Drawdown (%)
                  </label>
                  <div className="relative">
                    <input
                      id="maxDrawdown"
                      type="number"
                      value={maxDrawdown}
                      onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                      min="1"
                      max="100"
                      step="1"
                      className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="maxOpenTrades" className="block text-sm font-medium text-gray-300 mb-1">
                    Max Open Trades
                  </label>
                  <input
                    id="maxOpenTrades"
                    type="number"
                    value={maxOpenTrades}
                    onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
                    min="1"
                    max="50"
                    step="1"
                    className="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                  />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-5 h-5 text-neon-raspberry" />
                <h3 className="font-medium">Strategy Code Editor</h3>
              </div>
              
              <p className="text-sm text-gray-400">
                Write custom strategy logic using JavaScript. This code will be executed to determine trade signals.
              </p>
              
              <div className="h-96 border border-gunmetal-700 rounded-lg overflow-hidden">
                <ExpertCodeEditor
                  value={strategyCode}
                  onChange={setStrategyCode}
                  language="javascript"
                />
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between p-6 border-t border-gunmetal-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleCreateStrategy}
            disabled={isCreating}
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-gunmetal-950 border-t-transparent rounded-full"></span>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Create Strategy</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
