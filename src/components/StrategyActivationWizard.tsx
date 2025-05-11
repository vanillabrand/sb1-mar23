import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Strategy, StrategyBudget, RiskLevel, MarketType } from '../types';
import { AlertCircle, ArrowLeft, ArrowRight, Check, DollarSign, Shield, Zap } from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { demoService } from '../lib/demo-service';

interface StrategyActivationWizardProps {
  strategy: Strategy;
  onComplete: (success: boolean) => void;
  onCancel: () => void;
  maxBudget?: number;
}

export function StrategyActivationWizard({ 
  strategy, 
  onComplete, 
  onCancel,
  maxBudget = 10000
}: StrategyActivationWizardProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Budget state
  const [totalBudget, setTotalBudget] = useState<number>(
    Math.min((maxBudget || 0) * 0.1, maxBudget || 0)
  );
  const [availableBalance, setAvailableBalance] = useState<number>(maxBudget || 0);
  
  // Risk settings
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(strategy.risk_level || 'Medium');
  const [marketType, setMarketType] = useState<MarketType>(strategy.market_type || strategy.marketType || 'spot');
  
  // Demo mode
  const isDemoMode = demoService.isDemoMode();

  // Calculate position size multiplier based on risk level
  const positionSizeMultiplier = {
    'Low': 0.05,
    'Medium': 0.1,
    'High': 0.2
  }[riskLevel] || 0.1;

  // Fetch available balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balance = await walletBalanceService.getAvailableBalance(marketType);
        setAvailableBalance(balance);
      } catch (error) {
        logService.log('error', 'Failed to fetch available balance', error, 'StrategyActivationWizard');
        // Use max budget as fallback
        setAvailableBalance(maxBudget || 10000);
      }
    };

    fetchBalance();
  }, [marketType, maxBudget]);

  // Handle budget change
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseFloat(e.target.value);
    if (!isNaN(parsedValue)) {
      setTotalBudget(Number(parsedValue.toFixed(2)));
    }
  };

  // Handle risk level change
  const handleRiskLevelChange = (level: RiskLevel) => {
    setRiskLevel(level);
  };

  // Handle market type change
  const handleMarketTypeChange = (type: MarketType) => {
    setMarketType(type);
  };

  // Navigate to next step
  const handleNextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  // Navigate to previous step
  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Handle final submission
  const handleSubmit = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Create budget object
      const budget: StrategyBudget = {
        total: Number(totalBudget.toFixed(2)),
        allocated: 0,
        available: Number(totalBudget.toFixed(2)),
        maxPositionSize: Number((totalBudget * positionSizeMultiplier).toFixed(2)),
        market_type: marketType,
        marketType: marketType
      };

      // Set budget for strategy
      await tradeService.setBudget(strategy.id, budget);

      // Activate strategy
      await tradeService.activateStrategy(strategy.id);

      // Complete wizard
      setIsProcessing(false);
      onComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to activate strategy');
      setIsProcessing(false);
    }
  };

  // Render steps
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-white">Set Budget</h3>
            <p className="text-gray-400">
              Allocate a budget for this strategy. This is the maximum amount that will be used for trades.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Total Budget
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={totalBudget}
                    onChange={handleBudgetChange}
                    className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                    min={0}
                    max={availableBalance}
                    step={0.01}
                    required
                    disabled={isProcessing}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  Available: ${availableBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {isDemoMode && <span className="ml-2 text-neon-turquoise">(Demo)</span>}
                </p>
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
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-white">Risk Settings</h3>
            <p className="text-gray-400">
              Choose the risk level and market type for this strategy.
            </p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Risk Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Low', 'Medium', 'High'] as RiskLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleRiskLevelChange(level)}
                      className={`flex items-center justify-center py-2 px-4 rounded-lg border ${
                        riskLevel === level
                          ? 'bg-neon-turquoise/20 border-neon-turquoise text-white'
                          : 'bg-gunmetal-800 border-gunmetal-700 text-gray-400 hover:bg-gunmetal-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  {riskLevel === 'Low' && 'Conservative approach with smaller position sizes.'}
                  {riskLevel === 'Medium' && 'Balanced approach with moderate position sizes.'}
                  {riskLevel === 'High' && 'Aggressive approach with larger position sizes.'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Market Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['spot', 'margin', 'futures'] as MarketType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleMarketTypeChange(type)}
                      className={`flex items-center justify-center py-2 px-4 rounded-lg border capitalize ${
                        marketType === type
                          ? 'bg-neon-turquoise/20 border-neon-turquoise text-white'
                          : 'bg-gunmetal-800 border-gunmetal-700 text-gray-400 hover:bg-gunmetal-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
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
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-white">Confirm Activation</h3>
            <p className="text-gray-400">
              Review your settings and confirm strategy activation.
            </p>
            
            <div className="space-y-4 bg-gunmetal-800/50 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Strategy</span>
                <span className="text-white font-medium">{strategy.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Budget</span>
                <span className="text-white font-medium">${totalBudget.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Risk Level</span>
                <span className="text-white font-medium">{riskLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Market Type</span>
                <span className="text-white font-medium capitalize">{marketType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Position Size</span>
                <span className="text-white font-medium">${(totalBudget * positionSizeMultiplier).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trading Mode</span>
                <span className={`font-medium ${isDemoMode ? 'text-neon-turquoise' : 'text-neon-raspberry'}`}>
                  {isDemoMode ? 'Demo' : 'Live'}
                </span>
              </div>
            </div>
          </motion.div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget && !isProcessing) {
          onCancel();
        }
      }}
    >
      <div
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold gradient-text">
            Activate Strategy: {strategy.name}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Complete the following steps to activate your strategy
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Progress indicator */}
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

        {/* Step content */}
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          {currentStep > 0 ? (
            <button
              onClick={handlePrevStep}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
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
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  Activate
                  <Zap className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
