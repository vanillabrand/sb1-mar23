import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  Coins
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { aiService } from '../lib/ai-service';
import { useStrategies } from '../hooks/useStrategies';
import { RiskSlider } from './ui/RiskSlider';
import { Combobox } from './ui/Combobox';
import type { RiskLevel } from '../lib/types';

interface CreateStrategyModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const TOP_PAIRS = [
  'BTC_USDT',  // Bitcoin
  'ETH_USDT',  // Ethereum
  'SOL_USDT',  // Solana
  'BNB_USDT',  // Binance Coin
  'XRP_USDT',  // Ripple
  'ADA_USDT',  // Cardano
  'DOGE_USDT', // Dogecoin
  'MATIC_USDT', // Polygon
  'DOT_USDT',  // Polkadot
  'LINK_USDT'  // Chainlink
];

interface StrategyFormData {
  title: string;
  description: string;
  riskLevel: RiskLevel;
  selectedPairs: string[];
  marketRequirements: {
    trendFilter: boolean;
    volatilityFilter: boolean;
    correlationFilter: boolean;
    volumeFilter: boolean;
  };
  validationCriteria: {
    minWinRate: number;
    minProfitFactor: number;
    maxDrawdown: number;
    minTradeCount: number;
  };
  confirmationRules: {
    timeframes: string[];
    indicators: string[];
    minConfidence: number;
  };
}

export function CreateStrategyModal({ onClose, onCreated }: CreateStrategyModalProps) {
  const { user } = useAuth();
  const { createStrategy } = useStrategies();
  const [formData, setFormData] = useState<StrategyFormData>({
    title: '',
    description: '',
    riskLevel: 'Medium',
    selectedPairs: [],
    marketRequirements: {
      trendFilter: false,
      volatilityFilter: false,
      correlationFilter: false,
      volumeFilter: false,
    },
    validationCriteria: {
      minWinRate: 0,
      minProfitFactor: 0,
      maxDrawdown: 0,
      minTradeCount: 0,
    },
    confirmationRules: {
      timeframes: [],
      indicators: [],
      minConfidence: 0,
    },
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.selectedPairs.length === 0) {
      setError('Please select at least one trading pair');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // Generate strategy configuration with AI
      const strategyConfig = await aiService.generateStrategy(formData.description || formData.title, formData.riskLevel, {
        assets: formData.selectedPairs,
        timeframe: '1h',
        marketType: formData.riskLevel === 'High' || formData.riskLevel === 'Ultra High' || formData.riskLevel === 'Extreme' || formData.riskLevel === 'God Mode' ? 'futures' : 'spot',
        marketRequirements: formData.marketRequirements,
        validationCriteria: formData.validationCriteria,
        confirmationRules: formData.confirmationRules,
      });

      // Create strategy with generated config
      await createStrategy({
        title: formData.title,
        description: formData.description,
        risk_level: formData.riskLevel,
        user_id: user.id,
        strategy_config: strategyConfig,
        type: 'custom',
        status: 'inactive',
        performance: 0
      });

      onCreated();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create strategy');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-lg border border-gunmetal-800"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-neon-raspberry" />
            <h2 className="text-xl font-bold gradient-text">Create Strategy</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Strategy Name
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
              placeholder="Enter a name for your strategy"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-24 bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent resize-none"
              placeholder="Describe your trading strategy in natural language..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Trading Pairs
            </label>
            <div className="space-y-2">
              <Combobox
                options={TOP_PAIRS}
                selectedOptions={formData.selectedPairs}
                onSelect={(pair) => setFormData({ ...formData, selectedPairs: [...formData.selectedPairs, pair] })}
                onRemove={(pair) => setFormData({ ...formData, selectedPairs: formData.selectedPairs.filter(p => p !== pair) })}
                placeholder="Search trading pairs..."
                className="w-full"
              />
              <p className="text-xs text-gray-400">
                Select the trading pairs you want to include in your strategy
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Risk Level
            </label>
            <RiskSlider
              value={formData.riskLevel}
              onChange={(riskLevel) => setFormData({ ...formData, riskLevel })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gunmetal-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-[#FF69B4] transition-all duration-300 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Strategy...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Create Strategy
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
