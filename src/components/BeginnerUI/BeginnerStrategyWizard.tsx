import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  HelpCircle,
  Wallet,
  Layers,
  TrendingUp,
  Shield
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { strategyService } from '../../lib/strategy-service';
import { logService } from '../../lib/log-service';
import { Strategy } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/enhanced-supabase';

interface BeginnerStrategyWizardProps {
  onComplete: (strategy: Strategy) => void;
  onCancel: () => void;
}

export function BeginnerStrategyWizard({ onComplete, onCancel }: BeginnerStrategyWizardProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strategy data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [marketType, setMarketType] = useState<'spot' | 'margin' | 'futures'>('spot');
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [budget, setBudget] = useState(100);
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);

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
          'MATIC/USDT'
        ]);
      } catch (error) {
        logService.log('error', 'Failed to load available pairs', error, 'BeginnerStrategyWizard');
        setError('Failed to load available pairs. Please try again.');
      }
    };

    loadAvailablePairs();
  }, []);

  // Steps for the wizard
  const steps = [
    {
      title: 'Basic Information',
      description: 'Let\'s start with the basic details of your strategy',
      content: (
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
              placeholder="My First Strategy"
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Choose a name that helps you identify this strategy
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your strategy..."
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent h-24 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Add details about your strategy's goals or approach
            </p>
          </div>

          <div className="bg-gunmetal-900/50 rounded-lg p-4 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Strategy Basics</h4>
              <p className="text-sm text-gray-400">
                A good strategy name and description will help you remember what this strategy is designed to do.
                Be specific about your goals and the market conditions it's designed for.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Risk Level & Market Type',
      description: 'Choose your risk tolerance and market type',
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Risk Level
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setRiskLevel('Low')}
                className={`p-4 rounded-lg border ${
                  riskLevel === 'Low'
                    ? 'border-neon-green bg-neon-green/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-green font-medium">Low Risk</span>
                  {riskLevel === 'Low' && <Check className="w-5 h-5 text-neon-green" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Conservative approach with smaller, more consistent returns and lower drawdowns.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRiskLevel('Medium')}
                className={`p-4 rounded-lg border ${
                  riskLevel === 'Medium'
                    ? 'border-neon-yellow bg-neon-yellow/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-yellow font-medium">Medium Risk</span>
                  {riskLevel === 'Medium' && <Check className="w-5 h-5 text-neon-yellow" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Balanced approach with moderate returns and acceptable drawdowns.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRiskLevel('High')}
                className={`p-4 rounded-lg border ${
                  riskLevel === 'High'
                    ? 'border-neon-raspberry bg-neon-raspberry/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-raspberry font-medium">High Risk</span>
                  {riskLevel === 'High' && <Check className="w-5 h-5 text-neon-raspberry" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Aggressive approach with potential for higher returns but larger drawdowns.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Market Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setMarketType('spot')}
                className={`p-4 rounded-lg border ${
                  marketType === 'spot'
                    ? 'border-neon-turquoise bg-neon-turquoise/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-turquoise font-medium">Spot</span>
                  {marketType === 'spot' && <Check className="w-5 h-5 text-neon-turquoise" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Standard trading with direct buying and selling of assets. No leverage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMarketType('margin')}
                className={`p-4 rounded-lg border ${
                  marketType === 'margin'
                    ? 'border-neon-yellow bg-neon-yellow/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-yellow font-medium">Margin</span>
                  {marketType === 'margin' && <Check className="w-5 h-5 text-neon-yellow" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Trading with borrowed funds for increased position size. Moderate leverage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMarketType('futures')}
                className={`p-4 rounded-lg border ${
                  marketType === 'futures'
                    ? 'border-neon-raspberry bg-neon-raspberry/10'
                    : 'border-gunmetal-700 bg-gunmetal-800'
                } transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neon-raspberry font-medium">Futures</span>
                  {marketType === 'futures' && <Check className="w-5 h-5 text-neon-raspberry" />}
                </div>
                <p className="text-sm text-gray-400 text-left">
                  Trading contracts with high leverage. Highest risk and potential return.
                </p>
              </button>
            </div>
          </div>

          <div className="bg-gunmetal-900/50 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Risk Warning</h4>
              <p className="text-sm text-gray-400">
                Higher risk levels and leveraged trading (margin/futures) can lead to larger losses.
                Only use funds you can afford to lose, especially when using leverage.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Trading Pairs & Budget',
      description: 'Select the assets to trade and set your budget',
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Trading Pairs
            </label>
            <div className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
            <p className="text-xs text-gray-500 mt-1">
              Select one or more trading pairs for your strategy
            </p>
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
            <p className="text-xs text-gray-500 mt-1">
              Minimum budget: $10 USDT
            </p>

            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Recommended Budget</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBudget(100)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    budget === 100 ? 'bg-neon-turquoise text-white' : 'bg-gunmetal-800 text-gray-300'
                  }`}
                >
                  $100
                </button>
                <button
                  onClick={() => setBudget(250)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    budget === 250 ? 'bg-neon-turquoise text-white' : 'bg-gunmetal-800 text-gray-300'
                  }`}
                >
                  $250
                </button>
                <button
                  onClick={() => setBudget(500)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    budget === 500 ? 'bg-neon-turquoise text-white' : 'bg-gunmetal-800 text-gray-300'
                  }`}
                >
                  $500
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-900/50 rounded-lg p-4 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Trading Pairs & Budget Tips</h4>
              <p className="text-sm text-gray-400">
                Start with 1-3 trading pairs that you're familiar with. For beginners, major pairs like BTC/USDT and ETH/USDT
                are recommended due to their liquidity and stability. Set a budget you're comfortable with losing.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Review & Create',
      description: 'Review your strategy settings and create your strategy',
      content: (
        <div className="space-y-6">
          <div className="bg-gunmetal-900/50 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Strategy Summary</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="bg-gunmetal-800 rounded-full p-3">
                  <TrendingUp className="w-6 h-6 text-neon-turquoise" />
                </div>
                <div>
                  <h4 className="text-lg font-bold">{title || 'Untitled Strategy'}</h4>
                  <p className="text-sm text-gray-400">
                    {description || 'No description provided'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-gunmetal-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <h5 className="text-xs text-gray-500">Risk Level</h5>
                  </div>
                  <p className={`font-medium ${
                    riskLevel === 'Low' ? 'text-neon-green' :
                    riskLevel === 'Medium' ? 'text-neon-yellow' :
                    'text-neon-raspberry'
                  }`}>
                    {riskLevel}
                  </p>
                </div>

                <div className="bg-gunmetal-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <h5 className="text-xs text-gray-500">Budget</h5>
                  </div>
                  <p className="font-medium">${budget} USDT</p>
                </div>

                <div className="bg-gunmetal-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <h5 className="text-xs text-gray-500">Market Type</h5>
                  </div>
                  <p className="font-medium">
                    {marketType.charAt(0).toUpperCase() + marketType.slice(1)}
                  </p>
                </div>

                <div className="bg-gunmetal-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-gray-400" />
                    <h5 className="text-xs text-gray-500">Trading Pairs</h5>
                  </div>
                  <p className="font-medium">
                    {selectedPairs.length === 0
                      ? 'None selected'
                      : selectedPairs.length === 1
                        ? selectedPairs[0]
                        : `${selectedPairs.length} pairs selected`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-900/50 rounded-lg p-4 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-300 mb-1">What Happens Next?</h4>
              <p className="text-sm text-gray-400">
                Your strategy will be created but will remain inactive until you activate it.
                You can review and modify any settings before activating the strategy.
                Once activated, the platform will automatically manage trades based on your settings.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )
    }
  ];

  // Handle next step
  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      // Validate current step
      if (currentStep === 0 && !title.trim()) {
        setError('Please enter a strategy name');
        return;
      }

      if (currentStep === 2 && selectedPairs.length === 0) {
        setError('Please select at least one trading pair');
        return;
      }

      // Clear any previous errors
      setError(null);

      // Move to next step
      setCurrentStep(currentStep + 1);
    } else {
      // Create the strategy
      handleCreateStrategy();
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

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

      // Create a minimal strategy object
      const minimalStrategy = {
        id: uuidv4(),
        title: title.trim(),
        name: title.trim(),
        description: description.trim() || '',
        user_id: user.id,
        status: 'inactive',
        risk_level: riskLevel,
        riskLevel: riskLevel, // Keep for backward compatibility
        market_type: marketType, // Only use database column name
        selected_pairs: formattedPairs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type: 'custom'
      };

      // Insert the strategy into the database
      const { data: newStrategy, error } = await supabase
        .from('strategies')
        .insert(minimalStrategy)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Set the budget for the strategy
      if (newStrategy) {
        await strategyService.setBudget(newStrategy.id, budget);
      }

      // Call the onComplete callback with the new strategy
      onComplete(newStrategy);

    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'BeginnerStrategyWizard');
      setError('Failed to create strategy. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="panel-metallic rounded-xl overflow-hidden">
      <div className="p-6 border-b border-gunmetal-800">
        <h2 className="text-xl font-bold mb-2">Create a New Strategy</h2>
        <p className="text-gray-400">
          Follow these steps to create your trading strategy
        </p>
      </div>

      {/* Progress steps */}
      <div className="px-6 pt-6">
        <div className="flex items-center mb-6">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index === currentStep ? 'bg-neon-turquoise text-white' :
                  index < currentStep ? 'bg-neon-green text-white' :
                  'bg-gunmetal-800 text-gray-400'
                }`}>
                  {index < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span className="text-xs mt-1 text-gray-400">{step.title}</span>
              </div>

              {index < steps.length - 1 && (
                <div className={`h-0.5 w-12 mx-1 ${
                  index < currentStep ? 'bg-neon-green' : 'bg-gunmetal-800'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="px-6 pb-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-1">{steps[currentStep].title}</h3>
          <p className="text-sm text-gray-400">{steps[currentStep].description}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {steps[currentStep].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between p-6 border-t border-gunmetal-800">
        <div>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePreviousStep}
              className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors flex items-center gap-2"
              disabled={isCreating}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <button
            onClick={handleNextStep}
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
                <span>{currentStep === steps.length - 1 ? 'Create Strategy' : 'Next'}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
