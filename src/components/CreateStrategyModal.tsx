import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, XCircle } from 'lucide-react';
import { RiskSlider } from './ui/RiskSlider';
import { Combobox } from './ui/Combobox';
import { detectMarketType } from '../lib/market-type-detection';
import type { MarketType } from '../lib/types';

// Add these trading pair options
const TRADING_PAIRS = [
  { value: 'BTC_USDT', label: 'BTC/USDT', popular: true },
  { value: 'ETH_USDT', label: 'ETH/USDT', popular: true },
  { value: 'SOL_USDT', label: 'SOL/USDT', popular: true },
  { value: 'BNB_USDT', label: 'BNB/USDT', popular: true },
  { value: 'XRP_USDT', label: 'XRP/USDT' },
  { value: 'ADA_USDT', label: 'ADA/USDT' },
  { value: 'DOGE_USDT', label: 'DOGE/USDT' },
  { value: 'MATIC_USDT', label: 'MATIC/USDT' },
  { value: 'DOT_USDT', label: 'DOT/USDT' },
  { value: 'LINK_USDT', label: 'LINK/USDT' },
];

interface CreateStrategyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (data: CreateStrategyData) => Promise<void>;
}

interface CreateStrategyData {
  title: string;
  description: string;
  risk_level: string;
  selected_pairs: string[];
  marketType: MarketType;
}

export function CreateStrategyModal({ open, onClose, onCreated }: CreateStrategyModalProps) {
  const [formData, setFormData] = useState<CreateStrategyData>({
    title: '',
    description: '',
    risk_level: 'Medium',
    selected_pairs: ['BTC_USDT'], // Default to BTC_USDT as a starting pair
    marketType: 'spot'
  });

  // Detect market type from description when it changes
  useEffect(() => {
    if (formData.description) {
      const detectedMarketType = detectMarketType(formData.description);
      setFormData(prev => ({
        ...prev,
        marketType: detectedMarketType
      }));
    }
  }, [formData.description]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePairSelect = (pair: string) => {
    if (!formData.selected_pairs.includes(pair)) {
      setFormData(prev => ({
        ...prev,
        selected_pairs: [...prev.selected_pairs, pair]
      }));
    }
  };

  const handlePairRemove = (pair: string) => {
    setFormData(prev => ({
      ...prev,
      selected_pairs: prev.selected_pairs.filter(p => p !== pair)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Strategy name is required');
      return;
    }

    if (formData.selected_pairs.length === 0) {
      setError('Please select at least one trading pair');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Properly capitalize the strategy title
      // This will capitalize the first letter of each word
      const capitalizedTitle = formData.title
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Create a new form data object with the capitalized title
      const updatedFormData = {
        ...formData,
        title: capitalizedTitle
      };

      // Log the form data to verify fields
      console.log('CreateStrategyModal: Submitting form data:', {
        title: updatedFormData.title,
        description: updatedFormData.description,
        risk_level: updatedFormData.risk_level,
        selected_pairs: updatedFormData.selected_pairs,
        marketType: updatedFormData.marketType,
        pairs_count: updatedFormData.selected_pairs.length
      });

      // Format selected pairs to ensure they use the correct format (BTC/USDT instead of BTC_USDT)
      const formattedPairs = updatedFormData.selected_pairs.map(pair =>
        pair.includes('_') ? pair.replace('_', '/') : pair
      );

      // Create a copy of the form data with all required fields properly set
      const enrichedData = {
        ...updatedFormData,
        // Ensure title and name are set
        title: updatedFormData.title,
        name: updatedFormData.title,
        // Ensure market_type is set for database field
        market_type: updatedFormData.marketType,
        marketType: updatedFormData.marketType,
        // Ensure risk_level is set in both formats
        risk_level: updatedFormData.risk_level,
        riskLevel: updatedFormData.risk_level,
        // Ensure selected_pairs is properly formatted
        selected_pairs: formattedPairs,
        // Ensure status is set
        status: 'inactive',
        // Ensure type is set
        type: 'custom',
        // Add timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('CreateStrategyModal: Submitting enriched data:', {
        title: enrichedData.title, // This should now be properly capitalized
        description: enrichedData.description,
        risk_level: enrichedData.risk_level,
        selected_pairs: enrichedData.selected_pairs,
        marketType: enrichedData.marketType,
        market_type: enrichedData.market_type
      });

      await onCreated(enrichedData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center mobile-modal-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={(e) => {
          // Only close if clicking the backdrop, not the modal content
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl w-full max-w-xl mx-4 p-6 border border-gunmetal-800"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-neon-raspberry" />
              <h2 className="text-xl font-semibold text-gray-200">
                Create Strategy
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Strategy Name
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter a name for your strategy"
                className="w-full px-4 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:border-neon-raspberry"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your strategy..."
                className="w-full px-4 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:border-neon-raspberry h-24 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Risk Level
              </label>
              <RiskSlider
                value={formData.risk_level}
                onChange={(level) => setFormData({ ...formData, risk_level: level })}
                className="mt-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Market Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border ${formData.marketType === 'spot'
                    ? 'border-neon-turquoise bg-neon-turquoise/10 text-neon-turquoise'
                    : 'border-gunmetal-700 bg-gunmetal-800 text-gray-300 hover:border-gray-500'}`}
                  onClick={() => setFormData({ ...formData, marketType: 'spot' })}
                >
                  Spot
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border ${formData.marketType === 'margin'
                    ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                    : 'border-gunmetal-700 bg-gunmetal-800 text-gray-300 hover:border-gray-500'}`}
                  onClick={() => setFormData({ ...formData, marketType: 'margin' })}
                >
                  Margin
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border ${formData.marketType === 'futures'
                    ? 'border-neon-raspberry bg-neon-raspberry/10 text-neon-raspberry'
                    : 'border-gunmetal-700 bg-gunmetal-800 text-gray-300 hover:border-gray-500'}`}
                  onClick={() => setFormData({ ...formData, marketType: 'futures' })}
                >
                  Futures
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {formData.marketType === 'spot'
                  ? 'Spot trading involves buying and selling assets directly.'
                  : formData.marketType === 'margin'
                    ? 'Margin trading allows borrowing funds to increase position size.'
                    : 'Futures trading uses contracts with leverage for larger positions.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Trading Pairs
              </label>
              <div className="space-y-4">
                <Combobox
                  options={TRADING_PAIRS}
                  selectedValues={formData.selected_pairs}
                  onSelect={handlePairSelect}
                  placeholder="Search trading pairs..."
                />

                {formData.selected_pairs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.selected_pairs.map((pair) => (
                      <div
                        key={pair}
                        className="flex items-center gap-1.5 bg-gunmetal-800 text-gray-200 px-3 py-1.5 rounded-full text-sm min-w-[130px] md:min-w-[130px] mobile-truncate"
                      >
                        <span>{pair.replace('_', '/')}</span>
                        <button
                          type="button"
                          onClick={() => handlePairRemove(pair)}
                          className="text-gray-400 hover:text-neon-pink transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {formData.selected_pairs.length === 0 && (
                  <p className="text-sm text-gray-400">
                    Select at least one trading pair for your strategy
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-gray-200"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                <Brain className="w-4 h-4" />
                {isSubmitting ? 'Creating...' : 'Create Strategy'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
