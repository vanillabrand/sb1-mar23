import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  TrendingUp,
  Clock,
  DollarSign,
  Shield,
  Zap,
  BarChart2
} from 'lucide-react';

interface BeginnerStrategyGuideProps {
  onClose: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function BeginnerStrategyGuide({ onClose }: BeginnerStrategyGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('what-is-strategy');
  
  const toggleSection = (sectionId: string) => {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(sectionId);
    }
  };
  
  const guideSections: GuideSection[] = [
    {
      id: 'what-is-strategy',
      title: 'What is a Trading Strategy?',
      icon: <BookOpen className="w-5 h-5 text-neon-turquoise" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            A trading strategy is a systematic approach to buying and selling assets based on predefined rules and conditions.
            It helps you make consistent trading decisions by removing emotional biases.
          </p>
          
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h4 className="font-medium text-neon-turquoise mb-2">Key Components of a Strategy</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-turquoise mt-1 flex-shrink-0" />
                <span><strong>Trading Pairs:</strong> The cryptocurrency pairs you want to trade (e.g., BTC/USDT, ETH/USDT)</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-turquoise mt-1 flex-shrink-0" />
                <span><strong>Risk Level:</strong> How much risk you're willing to take (affects position sizing and stop-loss settings)</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-turquoise mt-1 flex-shrink-0" />
                <span><strong>Market Type:</strong> Spot, margin, or futures markets (each with different risk profiles)</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-turquoise mt-1 flex-shrink-0" />
                <span><strong>Budget:</strong> The amount of funds allocated to the strategy</span>
              </li>
            </ul>
          </div>
          
          <div className="flex justify-end">
            <a 
              href="https://www.investopedia.com/terms/t/trading-strategy.asp" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-turquoise flex items-center gap-1 hover:underline"
            >
              Learn more about trading strategies
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'strategy-types',
      title: 'Common Strategy Types',
      icon: <BarChart2 className="w-5 h-5 text-neon-yellow" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            There are several common types of trading strategies, each with different timeframes and approaches.
            Understanding these can help you choose the right strategy for your goals.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gunmetal-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-neon-raspberry" />
                <h4 className="font-medium text-neon-raspberry">Scalping</h4>
              </div>
              <p className="text-sm text-gray-400">
                Very short-term trading that aims to profit from small price movements.
                Trades last minutes to hours with many trades per day.
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Timeframe:</span>
                  <span>Minutes to hours</span>
                </div>
                <div className="flex justify-between">
                  <span>Trade Frequency:</span>
                  <span>Very High</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Level:</span>
                  <span>Medium to High</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gunmetal-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-neon-turquoise" />
                <h4 className="font-medium text-neon-turquoise">Day Trading</h4>
              </div>
              <p className="text-sm text-gray-400">
                Positions are opened and closed within the same day.
                Aims to profit from intraday price movements.
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Timeframe:</span>
                  <span>Hours to 1 day</span>
                </div>
                <div className="flex justify-between">
                  <span>Trade Frequency:</span>
                  <span>High</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Level:</span>
                  <span>Medium</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gunmetal-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-neon-green" />
                <h4 className="font-medium text-neon-green">Swing Trading</h4>
              </div>
              <p className="text-sm text-gray-400">
                Aims to capture "swings" in price over several days or weeks.
                Less time-intensive than day trading.
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Timeframe:</span>
                  <span>Days to weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>Trade Frequency:</span>
                  <span>Medium</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Level:</span>
                  <span>Medium</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gunmetal-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-neon-yellow" />
                <h4 className="font-medium text-neon-yellow">Position Trading</h4>
              </div>
              <p className="text-sm text-gray-400">
                Long-term approach holding positions for weeks, months, or even years.
                Based on fundamental analysis and long-term trends.
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Timeframe:</span>
                  <span>Weeks to months</span>
                </div>
                <div className="flex justify-between">
                  <span>Trade Frequency:</span>
                  <span>Low</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Level:</span>
                  <span>Low to Medium</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <a 
              href="https://www.coindesk.com/learn/crypto-trading-strategies-for-beginners/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-yellow flex items-center gap-1 hover:underline"
            >
              Learn more about trading types
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'risk-management',
      title: 'Risk Management',
      icon: <Shield className="w-5 h-5 text-neon-raspberry" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Risk management is crucial for long-term success in trading. It helps protect your capital
            and ensures you can continue trading even after losses.
          </p>
          
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h4 className="font-medium text-neon-raspberry mb-2">Key Risk Management Principles</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-raspberry mt-1 flex-shrink-0" />
                <span><strong>Position Sizing:</strong> Never risk too much on a single trade (1-2% of your total capital is recommended)</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-raspberry mt-1 flex-shrink-0" />
                <span><strong>Stop Loss:</strong> Always set a stop loss to limit potential losses on each trade</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-raspberry mt-1 flex-shrink-0" />
                <span><strong>Take Profit:</strong> Set profit targets to lock in gains when they reach your goals</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-raspberry mt-1 flex-shrink-0" />
                <span><strong>Diversification:</strong> Don't put all your funds into a single strategy or asset</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h4 className="font-medium text-neon-raspberry mb-2">Risk Levels Explained</h4>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-green"></div>
                  <h5 className="font-medium text-neon-green">Low Risk</h5>
                </div>
                <p className="text-sm text-gray-400 ml-5">
                  Conservative approach with smaller position sizes, tighter stop losses, and lower leverage.
                  Suitable for beginners or those with low risk tolerance.
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-yellow"></div>
                  <h5 className="font-medium text-neon-yellow">Medium Risk</h5>
                </div>
                <p className="text-sm text-gray-400 ml-5">
                  Balanced approach with moderate position sizes and stop losses.
                  Suitable for traders with some experience.
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-raspberry"></div>
                  <h5 className="font-medium text-neon-raspberry">High Risk</h5>
                </div>
                <p className="text-sm text-gray-400 ml-5">
                  Aggressive approach with larger position sizes, wider stop losses, and potentially higher leverage.
                  Only suitable for experienced traders with high risk tolerance.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <a 
              href="https://www.binance.com/en/blog/all/crypto-risk-management-strategies-for-beginners-421499824684903155" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-raspberry flex items-center gap-1 hover:underline"
            >
              Learn more about risk management
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'creating-strategy',
      title: 'Creating Your First Strategy',
      icon: <Zap className="w-5 h-5 text-neon-green" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Ready to create your first strategy? Here's a step-by-step guide to help you get started.
          </p>
          
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h4 className="font-medium text-neon-green mb-2">Step-by-Step Guide</h4>
            <ol className="space-y-3">
              <li className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gunmetal-700 flex items-center justify-center text-xs">1</div>
                <div>
                  <h5 className="font-medium text-gray-300">Choose a Strategy Type</h5>
                  <p className="text-sm text-gray-400">
                    Decide whether you want to do scalping, day trading, swing trading, or position trading
                    based on your availability and risk tolerance.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gunmetal-700 flex items-center justify-center text-xs">2</div>
                <div>
                  <h5 className="font-medium text-gray-300">Select Trading Pairs</h5>
                  <p className="text-sm text-gray-400">
                    Choose cryptocurrency pairs you're familiar with. For beginners, major pairs like
                    BTC/USDT and ETH/USDT are recommended due to their liquidity.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gunmetal-700 flex items-center justify-center text-xs">3</div>
                <div>
                  <h5 className="font-medium text-gray-300">Set Your Risk Level</h5>
                  <p className="text-sm text-gray-400">
                    Choose a risk level that matches your risk tolerance. For beginners,
                    starting with Low or Medium risk is recommended.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gunmetal-700 flex items-center justify-center text-xs">4</div>
                <div>
                  <h5 className="font-medium text-gray-300">Allocate a Budget</h5>
                  <p className="text-sm text-gray-400">
                    Decide how much money you want to allocate to this strategy.
                    Only use funds you can afford to lose.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gunmetal-700 flex items-center justify-center text-xs">5</div>
                <div>
                  <h5 className="font-medium text-gray-300">Review and Activate</h5>
                  <p className="text-sm text-gray-400">
                    Review your strategy settings and activate it when you're ready.
                    You can always deactivate it later if needed.
                  </p>
                </div>
              </li>
            </ol>
          </div>
          
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h4 className="font-medium text-neon-green mb-2">Beginner Tips</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-green mt-1 flex-shrink-0" />
                <span>Start with a small budget until you gain more experience</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-green mt-1 flex-shrink-0" />
                <span>Begin with spot trading before moving to margin or futures</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-green mt-1 flex-shrink-0" />
                <span>Monitor your strategy regularly and make adjustments as needed</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-neon-green mt-1 flex-shrink-0" />
                <span>Consider using strategy templates to get started quickly</span>
              </li>
            </ul>
          </div>
          
          <div className="flex justify-center mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neon-green text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
            >
              Create Your First Strategy
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )
    }
  ];
  
  return (
    <div className="panel-metallic rounded-xl overflow-hidden">
      <div className="p-6 border-b border-gunmetal-800">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-neon-turquoise" />
          <h2 className="text-xl font-bold">Strategy Guide for Beginners</h2>
        </div>
        <p className="text-gray-400 mt-2">
          Learn the basics of trading strategies and how to create effective ones
        </p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {guideSections.map(section => (
            <div key={section.id} className="bg-gunmetal-900/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {section.icon}
                  <h3 className="font-medium">{section.title}</h3>
                </div>
                {expandedSection === section.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 pb-4"
                >
                  {section.content}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end p-6 border-t border-gunmetal-800">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Close Guide
        </button>
      </div>
    </div>
  );
}
