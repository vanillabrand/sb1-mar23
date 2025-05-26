import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Shield,
  Play,
  Pause,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { strategyService } from '../../lib/strategy-service';
import { tradeService } from '../../lib/trade-service';
import { logService } from '../../lib/log-service';
import { supabase } from '../../lib/enhanced-supabase';
import { demoService } from '../../lib/demo-service';
import type { Strategy, StrategyBudget } from '../../lib/types';

interface UnifiedBeginnerWorkflowProps {
  onComplete: (strategy: Strategy) => void;
  onCancel: () => void;
}

export function UnifiedBeginnerWorkflow({ onComplete, onCancel }: UnifiedBeginnerWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Strategy configuration (auto-selected for beginners)
  const [budget, setBudget] = useState(250);
  const [strategyName, setStrategyName] = useState('');
  const [createdStrategy, setCreatedStrategy] = useState<Strategy | null>(null);

  // Auto-selected beginner-friendly settings
  const autoConfig = {
    marketType: 'spot' as const,
    riskLevel: 'Low' as const,
    tradingPairs: ['BTC/USDT', 'ETH/USDT'],
    maxPositionSize: 0.15, // 15% of budget per trade
    stopLoss: 0.05, // 5% stop loss
    takeProfit: 0.10, // 10% take profit
    indicators: ['SMA', 'RSI'] // Simple moving average and RSI
  };

  const steps = [
    { title: 'Name Your Strategy', description: 'Give your strategy a memorable name' },
    { title: 'Set Budget', description: 'Choose how much to invest' },
    { title: 'Review & Create', description: 'Confirm your settings' },
    { title: 'Activate Strategy', description: 'Start automated trading' }
  ];

  const budgetOptions = [
    { amount: 100, label: 'Conservative', description: 'Perfect for learning', risk: 'Very Low' },
    { amount: 250, label: 'Recommended', description: 'Balanced approach', risk: 'Low' },
    { amount: 500, label: 'Growth', description: 'Higher potential', risk: 'Medium' }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const createStrategy = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      logService.log('info', 'Creating unified beginner strategy', {
        name: strategyName,
        budget,
        autoConfig
      }, 'UnifiedBeginnerWorkflow');

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      // Create strategy with beginner-friendly defaults
      const strategyData = {
        user_id: session.user.id,
        title: strategyName,
        description: `Beginner-friendly strategy with automated settings. Budget: $${budget}`,
        riskLevel: autoConfig.riskLevel,
        type: 'beginner_auto' as const,
        status: 'inactive' as const,
        selected_pairs: autoConfig.tradingPairs,
        market_type: autoConfig.marketType,
        strategy_config: {
          assets: autoConfig.tradingPairs,
          marketType: autoConfig.marketType,
          riskLevel: autoConfig.riskLevel,
          maxPositionSize: autoConfig.maxPositionSize,
          stopLoss: autoConfig.stopLoss,
          takeProfit: autoConfig.takeProfit,
          indicators: autoConfig.indicators.map(name => ({ type: name, enabled: true })),
          autoTrading: true,
          beginnerMode: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert strategy into database
      const { data: newStrategy, error: createError } = await supabase
        .from('strategies')
        .insert(strategyData)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      if (!newStrategy) {
        throw new Error('Failed to create strategy - no data returned');
      }

      logService.log('info', 'Strategy created successfully', {
        strategyId: newStrategy.id,
        name: strategyName
      }, 'UnifiedBeginnerWorkflow');

      setCreatedStrategy(newStrategy);
      setSuccess('Strategy created successfully!');
      handleNext();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create strategy';
      logService.log('error', 'Failed to create strategy', error, 'UnifiedBeginnerWorkflow');
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const activateStrategy = async () => {
    if (!createdStrategy) {
      setError('No strategy to activate');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      logService.log('info', 'Starting strategy activation', {
        strategyId: createdStrategy.id,
        budget
      }, 'UnifiedBeginnerWorkflow');

      // Set budget first
      const strategyBudget: StrategyBudget = {
        total: budget,
        allocated: 0,
        available: budget,
        maxPositionSize: budget * autoConfig.maxPositionSize,
        lastUpdated: Date.now(),
        profit: 0,
        marketType: autoConfig.marketType,
        market_type: autoConfig.marketType
      };

      await tradeService.setBudget(createdStrategy.id, strategyBudget);
      logService.log('info', 'Budget set successfully', { strategyId: createdStrategy.id, budget }, 'UnifiedBeginnerWorkflow');

      // Activate strategy with direct database update to avoid API issues
      const { data: activatedStrategy, error: activationError } = await supabase
        .from('strategies')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', createdStrategy.id)
        .select()
        .single();

      if (activationError) {
        throw activationError;
      }

      if (!activatedStrategy) {
        throw new Error('Failed to activate strategy - no data returned');
      }

      logService.log('info', 'Strategy activated successfully', {
        strategyId: activatedStrategy.id,
        status: activatedStrategy.status
      }, 'UnifiedBeginnerWorkflow');

      setSuccess('Strategy activated and ready to trade!');
      
      // Complete the workflow
      setTimeout(() => {
        onComplete(activatedStrategy);
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      logService.log('error', 'Failed to activate strategy', error, 'UnifiedBeginnerWorkflow');
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Name Your Strategy</h3>
              <p className="text-gray-400">Choose a name that helps you remember this strategy</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="e.g., My First Trading Strategy"
                  className="w-full px-4 py-3 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
                />
              </div>

              <div className="bg-gunmetal-900/50 rounded-lg p-4">
                <h4 className="font-medium text-gray-300 mb-2">Auto-Selected Settings</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Market Type:</span>
                    <span className="text-white ml-2">Spot Trading</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Risk Level:</span>
                    <span className="text-green-400 ml-2">Low</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Trading Pairs:</span>
                    <span className="text-white ml-2">BTC/USDT, ETH/USDT</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Position:</span>
                    <span className="text-white ml-2">15% per trade</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!strategyName.trim()}
                className="flex-1 px-4 py-3 bg-neon-turquoise text-white rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Set Your Budget</h3>
              <p className="text-gray-400">Choose how much you want to invest in this strategy</p>
            </div>

            <div className="grid gap-4">
              {budgetOptions.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => setBudget(option.amount)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    budget === option.amount
                      ? 'border-neon-turquoise bg-neon-turquoise/10'
                      : 'border-gunmetal-700 bg-gunmetal-800/50 hover:border-gunmetal-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-semibold text-white">${option.amount}</div>
                      <div className="text-sm text-gray-400">{option.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-300">{option.description}</div>
                      <div className={`text-xs ${
                        option.risk === 'Very Low' ? 'text-green-400' :
                        option.risk === 'Low' ? 'text-yellow-400' : 'text-orange-400'
                      }`}>
                        {option.risk} Risk
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">Demo Mode Active</h4>
                  <p className="text-sm text-gray-400">
                    You're trading with virtual money. No real funds are at risk while you learn.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 px-4 py-3 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-3 bg-neon-turquoise text-white rounded-lg hover:bg-neon-yellow transition-colors flex items-center justify-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Review & Create</h3>
              <p className="text-gray-400">Confirm your strategy settings before creation</p>
            </div>

            <div className="bg-gunmetal-900/50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Strategy Name:</span>
                <span className="text-white font-medium">{strategyName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Budget:</span>
                <span className="text-white font-medium">${budget}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Market Type:</span>
                <span className="text-white">Spot Trading</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Risk Level:</span>
                <span className="text-green-400">Low</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Max Position Size:</span>
                <span className="text-white">${(budget * autoConfig.maxPositionSize).toFixed(0)} (15%)</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 px-4 py-3 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={createStrategy}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-neon-turquoise text-white rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create Strategy
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Activate Strategy</h3>
              <p className="text-gray-400">Start automated trading with your new strategy</p>
            </div>

            {createdStrategy && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div>
                    <h4 className="font-medium text-green-400">Strategy Created Successfully</h4>
                    <p className="text-sm text-gray-400">Ready to activate and start trading</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Strategy ID:</span>
                    <span className="text-white font-mono">{createdStrategy.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-yellow-400">Inactive (Ready to Activate)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gunmetal-900/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-300 mb-2">What happens when activated?</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Strategy will monitor BTC/USDT and ETH/USDT markets</li>
                <li>• Automatic trades will be executed based on market conditions</li>
                <li>• Maximum ${(budget * autoConfig.maxPositionSize).toFixed(0)} per trade (15% of budget)</li>
                <li>• 5% stop-loss and 10% take-profit automatically applied</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={activateStrategy}
                disabled={isProcessing || !createdStrategy}
                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Activating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Activate & Start Trading
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gunmetal-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">Create Trading Strategy</h2>
            <span className="text-sm text-gray-400">Step {currentStep + 1} of {steps.length}</span>
          </div>
          <div className="w-full bg-gunmetal-800 rounded-full h-2">
            <div
              className="bg-neon-turquoise h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`text-xs ${
                  index <= currentStep ? 'text-neon-turquoise' : 'text-gray-500'
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
