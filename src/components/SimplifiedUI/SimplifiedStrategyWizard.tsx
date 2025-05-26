import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  DollarSign,
  Target,
  Shield,
  Gauge,
  Crown
} from 'lucide-react';
import { strategyService } from '../../lib/strategy-service';
import { tradeService } from '../../lib/trade-service';
import { marketService } from '../../lib/market-service';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
import { MarketType, RiskLevel } from '../../lib/types';

interface SimplifiedStrategyWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function SimplifiedStrategyWizard({ onComplete, onCancel }: SimplifiedStrategyWizardProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemoMode = demoService.isDemoMode();

  // Form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('Medium');
  const [marketType, setMarketType] = useState<MarketType>('spot');
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC_USDT']);
  const [budget, setBudget] = useState(1000);
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState(10000);

  // Load available pairs on mount
  useEffect(() => {
    loadAvailablePairs();
    calculateMaxBudget();
  }, []);

  // Load available trading pairs
  const loadAvailablePairs = async () => {
    try {
      const pairs = await marketService.getAvailablePairs();
      setAvailablePairs(pairs);
    } catch (err) {
      logService.log('error', 'Failed to load available pairs', err, 'SimplifiedStrategyWizard');
    }
  };

  // Calculate max budget
  const calculateMaxBudget = async () => {
    try {
      const available = await tradeService.calculateAvailableBudget();
      setMaxBudget(available || 10000);
    } catch (err) {
      logService.log('error', 'Failed to calculate max budget', err, 'SimplifiedStrategyWizard');
    }
  };

  // Handle next step
  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 0) {
      if (!name) {
        setError('Strategy name is required');
        return;
      }
    } else if (currentStep === 1) {
      if (selectedPairs.length === 0) {
        setError('At least one trading pair is required');
        return;
      }
    }

    setError(null);
    setCurrentStep(prev => prev + 1);
  };

  // Handle previous step
  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(prev => prev - 1);
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Create strategy
      const strategy = await strategyService.createStrategy({
        name,
        description,
        risk_level: riskLevel,
        selected_pairs: selectedPairs.length > 0 ? selectedPairs : ['BTC_USDT'],
        market_type: marketType // Only use database column name
      });

      if (!strategy || !strategy.id) {
        throw new Error('Failed to create strategy - no valid strategy returned');
      }

      // Set budget
      await tradeService.setBudget(strategy.id, {
        total: budget,
        allocated: 0,
        available: budget,
        maxPositionSize: budget * 0.2 // 20% of total budget as max position size
      });

      // Activate strategy if auto-activate is enabled
      if (autoActivate) {
        await strategyService.activateStrategy(strategy.id);
      }

      // Log success
      logService.log('info', 'Strategy created successfully', {
        strategyId: strategy.id,
        name,
        budget
      }, 'SimplifiedStrategyWizard');

      // Important: Set isSubmitting to false before calling onComplete
      setIsSubmitting(false);

      // Call onComplete to close the wizard
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
      setIsSubmitting(false);
      logService.log('error', 'Failed to create strategy', err, 'SimplifiedStrategyWizard');
    }
  };

  // Add trading pair
  const handleAddPair = (pair: string) => {
    if (!selectedPairs.includes(pair)) {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  // Remove trading pair
  const handleRemovePair = (pair: string) => {
    setSelectedPairs(selectedPairs.filter(p => p !== pair));
  };

  // Auto-activate strategy after creation
  const [autoActivate, setAutoActivate] = useState(true);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold text-white">Basic Information</h3>
            <p className="text-gray-400">
              Enter the basic details for your trading strategy.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  placeholder="My Trading Strategy"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  placeholder="Describe your strategy..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Risk Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Low', 'Medium', 'High'].map((risk) => (
                    <button
                      key={risk}
                      type="button"
                      onClick={() => setRiskLevel(risk as RiskLevel)}
                      className={`p-3 rounded-lg flex items-center justify-center gap-2 ${
                        riskLevel === risk
                          ? risk === 'Low'
                            ? 'bg-neon-turquoise/20 text-neon-turquoise border border-neon-turquoise/30'
                            : risk === 'Medium'
                              ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/30'
                              : 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30'
                          : 'bg-gunmetal-800 text-gray-400 border border-gunmetal-700'
                      }`}
                    >
                      {risk === 'Low' && <Shield className="w-4 h-4" />}
                      {risk === 'Medium' && <Target className="w-4 h-4" />}
                      {risk === 'High' && <Gauge className="w-4 h-4" />}
                      {risk}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold text-white">Trading Configuration</h3>
            <p className="text-gray-400">
              Select the trading pairs and market type for your strategy.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Market Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['spot', 'margin', 'futures'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMarketType(type as MarketType)}
                      className={`p-3 rounded-lg capitalize ${
                        marketType === type
                          ? 'bg-neon-turquoise/20 text-neon-turquoise border border-neon-turquoise/30'
                          : 'bg-gunmetal-800 text-gray-400 border border-gunmetal-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Trading Pairs
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedPairs.map(pair => (
                    <div
                      key={pair}
                      className="px-3 py-1 bg-gunmetal-800 rounded-lg text-gray-300 flex items-center gap-2"
                    >
                      {pair.replace('_', '/')}
                      <button
                        type="button"
                        onClick={() => handleRemovePair(pair)}
                        className="text-gray-400 hover:text-neon-pink"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <select
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPair(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Add trading pair...</option>
                  {availablePairs
                    .filter(pair => !selectedPairs.includes(pair))
                    .map(pair => (
                      <option key={pair} value={pair}>
                        {pair.replace('_', '/')}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold text-white">Budget Allocation</h3>
            <p className="text-gray-400">
              Set the budget for your strategy and review your settings.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-gray-300 mb-1">
                  Budget (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    id="budget"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    min={10}
                    max={maxBudget}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Maximum available: ${maxBudget.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="autoActivate"
                  checked={autoActivate}
                  onChange={(e) => setAutoActivate(e.target.checked)}
                  className="w-4 h-4 bg-gunmetal-800 border border-gunmetal-700 rounded text-neon-turquoise focus:ring-neon-turquoise"
                />
                <label htmlFor="autoActivate" className="text-sm text-gray-300">
                  Automatically activate strategy after creation
                </label>
              </div>

              <div className="bg-gunmetal-800/50 rounded-lg p-4 mt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Strategy Summary</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-gray-200">{name}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Risk Level:</span>
                    <span className="text-gray-200">{riskLevel}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Market Type:</span>
                    <span className="text-gray-200 capitalize">{marketType}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Trading Pairs:</span>
                    <span className="text-gray-200">{selectedPairs.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Budget:</span>
                    <span className="text-gray-200">${budget.toLocaleString()}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-400">Mode:</span>
                    <span className={isDemoMode ? 'text-neon-yellow' : 'text-neon-turquoise'}>
                      {isDemoMode ? 'Demo' : 'Live'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">
            Create New Strategy
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

        {/* Progress Steps */}
        <div className="flex items-center mb-6">
          {[0, 1, 2].map((step) => (
            <React.Fragment key={step}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === step
                    ? 'bg-neon-turquoise text-gunmetal-900'
                    : currentStep > step
                    ? 'bg-neon-turquoise/20 text-neon-turquoise'
                    : 'bg-gunmetal-800 text-gray-400'
                }`}
              >
                {currentStep > step ? <Check className="w-4 h-4" /> : step + 1}
              </div>
              {step < 2 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    currentStep > step ? 'bg-neon-turquoise/50' : 'bg-gunmetal-800'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          {currentStep > 0 ? (
            <button
              onClick={handlePrevStep}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
          )}

          {currentStep < 2 ? (
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Strategy
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
