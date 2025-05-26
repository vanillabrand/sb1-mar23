import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Brain, TrendingUp, Gauge, Loader2, Check } from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { logService } from '../lib/log-service';
import { AIService } from '../lib/ai-service';
import type { Strategy } from '../lib/supabase-types';

interface StrategyExample {
  title: string;
  description: string;
  type: string;
  performance: string;
  risk: 'Low' | 'Medium' | 'High';
  icon: React.ReactNode;
  config?: any;
}

interface StrategyExamplesProps {
  onStrategyCreated?: () => void;
}

export function StrategyExamples({ onStrategyCreated }: StrategyExamplesProps) {
  const { createStrategy } = useStrategies();
  const [hoveredStrategy, setHoveredStrategy] = useState<number | null>(null);
  const [creatingStrategy, setCreatingStrategy] = useState<number | null>(null);

  const examples: StrategyExample[] = [
    {
      title: "RSI Reversal Strategy",
      description: "Buy when RSI crosses above 30, sell when it crosses below 70. Perfect for volatile markets with clear trends.",
      type: "Mean Reversion",
      performance: "+18.5% / month",
      risk: "Medium",
      icon: <Gauge className="w-6 h-6 text-neon-turquoise" />,
      config: {
        market_type: "spot",
        assets: ["BTC_USDT", "ETH_USDT"],
        trade_parameters: {
          leverage: 1,
          position_size: 0.1,
          confidence_factor: 0.7
        },
        risk_management: {
          stop_loss: 2,
          take_profit: 6,
          trailing_stop_loss: 1,
          max_drawdown: 15
        },
        indicators: [
          {
            name: "RSI",
            parameters: { period: 14 },
            weight: 1
          }
        ]
      }
    },
    {
      title: "MACD Momentum",
      description: "Captures market momentum by entering trades when MACD crosses signal line with volume confirmation.",
      type: "Momentum",
      performance: "+24.2% / month",
      risk: "High",
      icon: <TrendingUp className="w-6 h-6 text-neon-orange" />,
      config: {
        market_type: "futures",
        assets: ["BTC_USDT", "ETH_USDT"],
        trade_parameters: {
          leverage: 3,
          position_size: 0.15,
          confidence_factor: 0.8
        },
        risk_management: {
          stop_loss: 3,
          take_profit: 9,
          trailing_stop_loss: 2,
          max_drawdown: 20
        },
        indicators: [
          {
            name: "MACD",
            parameters: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9
            },
            weight: 1.5
          }
        ]
      }
    },
    {
      title: "AI Market Analyzer",
      description: "Uses machine learning to predict market movements based on multiple technical indicators and sentiment analysis.",
      type: "AI-Powered",
      performance: "+32.7% / month",
      risk: "High",
      icon: <Brain className="w-6 h-6 text-neon-pink" />,
      config: {
        market_type: "futures",
        assets: ["BTC_USDT", "ETH_USDT", "SOL_USDT"],
        trade_parameters: {
          leverage: 5,
          position_size: 0.2,
          confidence_factor: 0.85
        },
        risk_management: {
          stop_loss: 4,
          take_profit: 12,
          trailing_stop_loss: 2,
          max_drawdown: 25
        },
        indicators: [
          {
            name: "RSI",
            parameters: { period: 14 },
            weight: 1
          },
          {
            name: "MACD",
            parameters: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9
            },
            weight: 1
          },
          {
            name: "BollingerBands",
            parameters: {
              period: 20,
              stdDev: 2
            },
            weight: 1
          }
        ]
      }
    }
  ];

  const getRiskColor = (risk: 'Low' | 'Medium' | 'High') => {
    switch (risk) {
      case 'Low': return 'text-neon-turquoise';
      case 'Medium': return 'text-neon-yellow';
      case 'High': return 'text-neon-orange';
    }
  };

  const handleUseTemplate = async (template: StrategyExample, index: number) => {
    try {
      setCreatingStrategy(index);
      logService.log('info', `Creating strategy from template: ${template.title}`, null, 'StrategyExamples');

      // Create strategy with template data
      const strategy = await createStrategy({
        title: template.title,
        description: template.description,
        risk_level: template.risk === 'Low' ? 'Low' :
                   template.risk === 'Medium' ? 'Medium' : 'High'
      });

      // If template has predefined config, use it
      if (template.config) {
        await AIService.generateStrategy(template.description, template.risk);
      }

      logService.log('info', `Strategy created successfully from template: ${strategy.id}`, strategy, 'StrategyExamples');
      onStrategyCreated?.();
    } catch (error) {
      logService.log('error', `Failed to create strategy from template: ${template.title}`, error, 'StrategyExamples');
    } finally {
      setCreatingStrategy(null);
    }
  };

  return (
    <div className="bg-gunmetal-900/40 backdrop-blur-xl rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold gradient-text">Popular Strategies</h2>
        <button className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors flex items-center gap-1">
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {examples.map((strategy, index) => (
          <motion.div
            key={index}
            onMouseEnter={() => setHoveredStrategy(index)}
            onMouseLeave={() => setHoveredStrategy(null)}
            className="bg-gunmetal-800/30 rounded-lg p-5 transition-all duration-300"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-3">
                {strategy.icon}
                <h3 className="font-semibold text-gray-200">{strategy.title}</h3>
              </div>

              <p className="text-sm text-gray-400 mb-4 flex-grow">{strategy.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="bg-gunmetal-900/40 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-300">{strategy.type}</p>
                </div>
                <div className="bg-gunmetal-900/40 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1">Risk</p>
                  <p className={`text-sm font-medium ${getRiskColor(strategy.risk)}`}>{strategy.risk}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gunmetal-700/50 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Performance</p>
                  <p className="text-sm font-semibold text-neon-turquoise">{strategy.performance}</p>
                </div>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredStrategy === index ? 1 : 0 }}
                  onClick={() => handleUseTemplate(strategy, index)}
                  disabled={creatingStrategy === index}
                  className="text-sm flex items-center gap-1 text-neon-yellow hover:text-neon-orange transition-colors disabled:opacity-50"
                >
                  {creatingStrategy === index ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Use Strategy
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}