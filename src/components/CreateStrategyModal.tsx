import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, XCircle } from 'lucide-react';
import { RiskSlider } from './ui/RiskSlider';
import { Combobox } from './ui/Combobox';

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
}

export function CreateStrategyModal({ open, onClose, onCreated }: CreateStrategyModalProps) {
  const [formData, setFormData] = useState<CreateStrategyData>({
    title: '',
    description: '',
    risk_level: 'Medium',
    selected_pairs: []
  });
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
      await onCreated(formData);
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
