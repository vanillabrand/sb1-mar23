import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, ChevronRight, ChevronLeft, Check, HelpCircle, AlertTriangle, DollarSign, Zap, Shield, TrendingUp, Target } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { strategyService } from '../../lib/strategy-service';
import { tradeService } from '../../lib/trade-service';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { eventBus } from '../../lib/event-bus';
import { marketService } from '../../lib/market-service';

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  simpleDescription: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  complexity: 'Simple' | 'Moderate' | 'Advanced';
  recommendedBudget: number;
  minBudget: number;
  maxBudget: number;
  icon: React.ReactNode;
  marketType: 'spot' | 'margin' | 'futures';
  selectedPairs: string[];
  autoSettings: {
    stopLoss: number;
    takeProfit: number;
    maxPositionSize: number;
    riskPerTrade: number;
  };
}

interface GuidedStrategyCreationProps {
  onComplete?: () => void;
  onStrategyCreated?: (strategy: any) => void;
}

export function GuidedStrategyCreation({ onComplete, onStrategyCreated }: GuidedStrategyCreationProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(100);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdStrategy, setCreatedStrategy] = useState<any>(null);

  // Strategy templates for beginners - fully automated
  const strategyTemplates: StrategyTemplate[] = [
    {
      id: 'safe-start',
      name: 'Safe Start',
      description: 'Perfect for beginners - focuses on Bitcoin with very conservative settings.',
      simpleDescription: 'Start safe with Bitcoin. Low risk, steady growth.',
      riskLevel: 'Low',
      complexity: 'Simple',
      recommendedBudget: 100,
      minBudget: 50,
      maxBudget: 500,
      marketType: 'spot',
      selectedPairs: ['BTC/USDT'],
      autoSettings: {
        stopLoss: 3, // 3% stop loss
        takeProfit: 6, // 6% take profit
        maxPositionSize: 0.15, // 15% of budget per trade
        riskPerTrade: 0.02 // 2% risk per trade
      },
      icon: <Shield className="w-8 h-8 text-neon-green" />
    },
    {
      id: 'smart-growth',
      name: 'Smart Growth',
      description: 'Balanced approach with Bitcoin and Ethereum for steady growth.',
      simpleDescription: 'Grow smartly with top cryptocurrencies. Balanced risk.',
      riskLevel: 'Medium',
      complexity: 'Simple',
      recommendedBudget: 250,
      minBudget: 100,
      maxBudget: 1000,
      marketType: 'spot',
      selectedPairs: ['BTC/USDT', 'ETH/USDT'],
      autoSettings: {
        stopLoss: 4, // 4% stop loss
        takeProfit: 8, // 8% take profit
        maxPositionSize: 0.20, // 20% of budget per trade
        riskPerTrade: 0.03 // 3% risk per trade
      },
      icon: <TrendingUp className="w-8 h-8 text-neon-turquoise" />
    },
    {
      id: 'opportunity-seeker',
      name: 'Opportunity Seeker',
      description: 'For those ready to take more risk for potentially higher returns.',
      simpleDescription: 'Seek bigger opportunities. Higher risk, higher potential.',
      riskLevel: 'High',
      complexity: 'Simple',
      recommendedBudget: 500,
      minBudget: 200,
      maxBudget: 2000,
      marketType: 'spot',
      selectedPairs: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
      autoSettings: {
        stopLoss: 5, // 5% stop loss
        takeProfit: 12, // 12% take profit
        maxPositionSize: 0.25, // 25% of budget per trade
        riskPerTrade: 0.05 // 5% risk per trade
      },
      icon: <Target className="w-8 h-8 text-neon-raspberry" />
    }
  ];

  // Steps for the guided creation process - simplified for beginners
  const steps = [
    {
      title: 'Choose Your Style',
      description: 'Pick the trading style that feels right for you.',
      content: (
        <div className="space-y-4 py-4">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm">
              Don't worry about the details - we'll handle all the technical settings for you!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {strategyTemplates.map((template) => (
              <motion.div
                key={template.id}
                whileHover={{ scale: 1.02 }}
                className={`rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                  selectedTemplate === template.id
                    ? 'bg-gunmetal-800 border-2 border-neon-turquoise shadow-lg shadow-neon-turquoise/20'
                    : 'bg-gunmetal-900 border border-gunmetal-800 hover:bg-gunmetal-800'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="bg-gunmetal-800 rounded-full p-4 flex-shrink-0">
                    {template.icon}
                  </div>

                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold">{template.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        template.riskLevel === 'Low' ? 'bg-neon-green/20 text-neon-green' :
                        template.riskLevel === 'Medium' ? 'bg-neon-yellow/20 text-neon-yellow' :
                        'bg-neon-raspberry/20 text-neon-raspberry'
                      }`}>
                        {template.riskLevel} Risk
                      </span>
                    </div>

                    <p className="text-lg text-gray-300 mb-3">{template.simpleDescription}</p>
                    <p className="text-sm text-gray-400 mb-4">{template.description}</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gunmetal-700 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Recommended Budget</div>
                        <div className="text-lg font-bold text-neon-turquoise">${template.recommendedBudget}</div>
                      </div>
                      <div className="bg-gunmetal-700 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Trading Pairs</div>
                        <div className="text-sm font-medium">{template.selectedPairs.join(', ')}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ✨ All settings automatically optimized for beginners
                      </div>
                      <button
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                          selectedTemplate === template.id
                            ? 'bg-neon-turquoise text-white'
                            : 'bg-gunmetal-700 text-white hover:bg-gunmetal-600'
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        {selectedTemplate === template.id ? '✓ Selected' : 'Choose This'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Set Your Budget',
      description: 'How much would you like to start with?',
      content: (
        <div className="py-4">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm">
              Start small and grow your confidence. You can always add more later!
            </p>
          </div>

          <div className="bg-gunmetal-900 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">Choose Your Starting Budget</h3>

            {selectedTemplate && (
              <div className="mb-6 p-4 bg-gunmetal-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-neon-turquoise" />
                  <span className="font-medium">Smart Recommendation</span>
                </div>
                <p className="text-sm text-gray-400">
                  For {strategyTemplates.find(t => t.id === selectedTemplate)?.name}, we recommend starting with{' '}
                  <span className="text-neon-turquoise font-bold">
                    ${strategyTemplates.find(t => t.id === selectedTemplate)?.recommendedBudget}
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {selectedTemplate && strategyTemplates.find(t => t.id === selectedTemplate) && (
                <>
                  <button
                    onClick={() => setBudget(strategyTemplates.find(t => t.id === selectedTemplate)!.minBudget)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      budget === strategyTemplates.find(t => t.id === selectedTemplate)!.minBudget
                        ? 'border-neon-green bg-neon-green/10'
                        : 'border-gunmetal-700 hover:border-gunmetal-600'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neon-green mb-1">
                        ${strategyTemplates.find(t => t.id === selectedTemplate)!.minBudget}
                      </div>
                      <div className="text-xs text-gray-400">Conservative Start</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setBudget(strategyTemplates.find(t => t.id === selectedTemplate)!.recommendedBudget)}
                    className={`p-4 rounded-lg border-2 transition-all relative ${
                      budget === strategyTemplates.find(t => t.id === selectedTemplate)!.recommendedBudget
                        ? 'border-neon-turquoise bg-neon-turquoise/10'
                        : 'border-gunmetal-700 hover:border-gunmetal-600'
                    }`}
                  >
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <span className="bg-neon-turquoise text-white text-xs px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neon-turquoise mb-1">
                        ${strategyTemplates.find(t => t.id === selectedTemplate)!.recommendedBudget}
                      </div>
                      <div className="text-xs text-gray-400">Balanced Approach</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setBudget(strategyTemplates.find(t => t.id === selectedTemplate)!.maxBudget)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      budget === strategyTemplates.find(t => t.id === selectedTemplate)!.maxBudget
                        ? 'border-neon-raspberry bg-neon-raspberry/10'
                        : 'border-gunmetal-700 hover:border-gunmetal-600'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neon-raspberry mb-1">
                        ${strategyTemplates.find(t => t.id === selectedTemplate)!.maxBudget}
                      </div>
                      <div className="text-xs text-gray-400">Aggressive Growth</div>
                    </div>
                  </button>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="budget" className="block text-sm font-medium mb-2">
                  Or enter a custom amount (USDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    id="budget"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    min={selectedTemplate ? strategyTemplates.find(t => t.id === selectedTemplate)?.minBudget : 10}
                    step="10"
                    className="w-full pl-8 pr-4 py-3 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise text-lg"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Minimum: ${selectedTemplate ? strategyTemplates.find(t => t.id === selectedTemplate)?.minBudget : 10} USDT
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-900 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-gunmetal-800 rounded-full p-3 mt-1">
                <Shield className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Your Money is Protected</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>Automatic stop-losses protect your investment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>Smart position sizing limits your risk per trade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>You can pause or adjust your strategy anytime</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Review & Activate',
      description: 'Everything looks good? Let\'s start trading!',
      content: (
        <div className="py-4">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm">
              Perfect! Your strategy is ready. Let's activate it and start trading!
            </p>
          </div>

          <div className="bg-gunmetal-900 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">Your Trading Strategy</h3>

            {selectedTemplate && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-gunmetal-800 rounded-full p-4">
                    {strategyTemplates.find(t => t.id === selectedTemplate)?.icon}
                  </div>
                  <div className="flex-grow">
                    <h4 className="text-xl font-bold mb-2">
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.name}
                    </h4>
                    <p className="text-gray-300 mb-2">
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.simpleDescription}
                    </p>
                    <p className="text-sm text-gray-400">
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gunmetal-800 p-4 rounded-lg">
                    <h5 className="text-sm text-gray-500 mb-2">Your Investment</h5>
                    <p className="text-2xl font-bold text-neon-turquoise">${budget} USDT</p>
                  </div>

                  <div className="bg-gunmetal-800 p-4 rounded-lg">
                    <h5 className="text-sm text-gray-500 mb-2">Risk Level</h5>
                    <p className={`text-lg font-bold ${
                      strategyTemplates.find(t => t.id === selectedTemplate)?.riskLevel === 'Low' ? 'text-neon-green' :
                      strategyTemplates.find(t => t.id === selectedTemplate)?.riskLevel === 'Medium' ? 'text-neon-yellow' :
                      'text-neon-raspberry'
                    }`}>
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.riskLevel}
                    </p>
                  </div>

                  <div className="bg-gunmetal-800 p-4 rounded-lg">
                    <h5 className="text-sm text-gray-500 mb-2">Trading Pairs</h5>
                    <p className="font-medium">
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.selectedPairs.join(', ')}
                    </p>
                  </div>

                  <div className="bg-gunmetal-800 p-4 rounded-lg">
                    <h5 className="text-sm text-gray-500 mb-2">Market Type</h5>
                    <p className="font-medium capitalize">
                      {strategyTemplates.find(t => t.id === selectedTemplate)?.marketType} Trading
                    </p>
                  </div>
                </div>

                {/* Auto-configured settings */}
                <div className="bg-gunmetal-800 rounded-lg p-4">
                  <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-neon-turquoise" />
                    Automatically Configured for You
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Stop Loss</div>
                      <div className="font-medium text-neon-green">
                        {strategyTemplates.find(t => t.id === selectedTemplate)?.autoSettings.stopLoss}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Take Profit</div>
                      <div className="font-medium text-neon-green">
                        {strategyTemplates.find(t => t.id === selectedTemplate)?.autoSettings.takeProfit}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Max Position</div>
                      <div className="font-medium text-neon-green">
                        {(strategyTemplates.find(t => t.id === selectedTemplate)?.autoSettings.maxPositionSize! * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Risk Per Trade</div>
                      <div className="font-medium text-neon-green">
                        {(strategyTemplates.find(t => t.id === selectedTemplate)?.autoSettings.riskPerTrade! * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gunmetal-900 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-gunmetal-800 rounded-full p-3 mt-1">
                <Zap className="w-6 h-6 text-neon-turquoise" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">Ready to Start Trading!</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>Your strategy will be created and automatically activated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>AI will start analyzing the market and making trades for you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-neon-green mt-0.5" />
                    <span>You can monitor progress and pause anytime from the dashboard</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Handle next step
  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
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
    }
  };

  // Handle strategy creation and activation
  const handleCreateStrategy = async () => {
    if (!user) {
      setError('You must be logged in to create a strategy');
      return;
    }

    if (!selectedTemplate) {
      setError('Please select a strategy template');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 Starting automated strategy creation and activation...');

      const template = strategyTemplates.find(t => t.id === selectedTemplate);
      if (!template) {
        throw new Error('Selected template not found');
      }

      console.log('📋 Template found:', template);

      // Create strategy data with all automated settings
      const strategyData = {
        name: template.name,
        title: template.name,
        description: template.description,
        riskLevel: template.riskLevel,
        market_type: template.marketType,
        selected_pairs: template.selectedPairs,
        strategy_config: {
          template_id: template.id,
          complexity: template.complexity,
          recommended_budget: template.recommendedBudget,
          auto_settings: template.autoSettings,
          indicators: ['RSI', 'MACD', 'EMA'], // Default indicators for beginners
          assets: template.selectedPairs,
          stop_loss: template.autoSettings.stopLoss,
          take_profit: template.autoSettings.takeProfit,
          max_position_size: template.autoSettings.maxPositionSize,
          risk_per_trade: template.autoSettings.riskPerTrade,
          automated: true, // Mark as automated for beginners
          beginner_mode: true
        },
        status: 'active' as const // Automatically activate for beginners
      };

      console.log('📊 Strategy data prepared:', strategyData);

      logService.log('info', 'Creating automated beginner strategy', {
        template: template.id,
        budget,
        strategyData
      }, 'GuidedStrategyCreation');

      console.log('🔄 Calling strategyService.createStrategy...');

      // Create the strategy
      const createdStrategy = await strategyService.createStrategy(strategyData);

      console.log('✅ Strategy created successfully:', createdStrategy);

      // Set the budget for the strategy with automated settings
      if (createdStrategy && budget > 0) {
        const strategyBudget = {
          total: budget,
          allocated: 0,
          available: budget,
          maxPositionSize: budget * template.autoSettings.maxPositionSize,
          lastUpdated: Date.now(),
          profit: 0,
          marketType: template.marketType as const
        };
        await tradeService.setBudget(createdStrategy.id, strategyBudget);
      }

      // Since we're creating it as active, we need to ensure it's properly activated
      try {
        console.log('🔄 Activating strategy automatically...');
        await strategyService.activateStrategy(createdStrategy.id);
        console.log('✅ Strategy activated successfully');
      } catch (activationError) {
        console.warn('⚠️ Strategy created but activation failed:', activationError);
        // Don't fail the whole process if activation fails
      }

      logService.log('info', 'Beginner strategy created and activated successfully', {
        strategyId: createdStrategy.id,
        name: createdStrategy.name,
        budget,
        autoSettings: template.autoSettings
      }, 'GuidedStrategyCreation');

      // Emit events to update UI
      eventBus.emit('strategy:created', createdStrategy);
      eventBus.emit('strategy:activated', createdStrategy);
      eventBus.emit('strategies:updated', strategySync.getAllStrategies());

      // Call callbacks
      if (onStrategyCreated) {
        onStrategyCreated(createdStrategy);
      }

      // Show success state
      setCreatedStrategy(createdStrategy);
      setIsSuccess(true);
      setIsCreating(false);

      // Auto-close after showing success
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 4000); // Slightly longer to show the success message

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create strategy';
      setError(errorMessage);
      setIsCreating(false);
      logService.log('error', 'Failed to create beginner strategy', err, 'GuidedStrategyCreation');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-6 h-6 text-neon-turquoise" />
        <h2 className="text-xl font-bold">Create a Strategy</h2>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Success Display */}
      {isSuccess && createdStrategy && (
        <div className="mb-6 p-6 bg-neon-green/10 border border-neon-green/20 text-neon-green rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-neon-green/20 rounded-full p-3">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">🎉 You're All Set!</h3>
              <p className="text-sm text-gray-400">"{createdStrategy.name}" is now active and trading for you!</p>
            </div>
          </div>
          <div className="bg-gunmetal-900 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Check className="w-5 h-5" />
              What's Happening Now:
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-neon-green rounded-full mt-2"></div>
                <span>Your strategy is <strong className="text-neon-green">ACTIVE</strong> and monitoring the market</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-neon-turquoise rounded-full mt-2"></div>
                <span>AI is analyzing {selectedTemplate && strategyTemplates.find(t => t.id === selectedTemplate)?.selectedPairs.join(', ')} for trading opportunities</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-neon-yellow rounded-full mt-2"></div>
                <span>Your ${budget} budget is protected with automatic risk management</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-neon-raspberry rounded-full mt-2"></div>
                <span>Check the Trade Monitor to see your strategy in action!</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Progress steps - Hide when success is shown */}
      {!isSuccess && (
        <>
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

        {/* Step content */}
        <div className="bg-gunmetal-900/50 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-2">{steps[currentStep].title}</h3>
          <p className="text-sm text-gray-400 mb-4">{steps[currentStep].description}</p>

          <div className="mt-4">
            {steps[currentStep].content}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
        <button
          onClick={handlePreviousStep}
          disabled={currentStep === 0}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            currentStep === 0 ? 'bg-gunmetal-800 text-gray-500 cursor-not-allowed' : 'bg-gunmetal-800 text-white hover:bg-gunmetal-700'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleNextStep}
          disabled={
            (currentStep === 0 && !selectedTemplate) ||
            (currentStep === 1 && (!budget || budget < 10)) ||
            isCreating
          }
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            ((currentStep === 0 && !selectedTemplate) ||
            (currentStep === 1 && (!budget || budget < 10)) ||
            isCreating)
              ? 'bg-gunmetal-800 text-gray-500 cursor-not-allowed'
              : 'bg-neon-turquoise text-white hover:bg-opacity-90'
          }`}
        >
          {isCreating ? (
            <>
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              <span>Creating & Activating...</span>
            </>
          ) : (
            <>
              {currentStep === steps.length - 1 ? (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Start Trading Now!</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </>
          )}
        </button>
        </div>
        </>
      )}
    </div>
  );
}
