import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain,
  Activity,
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStrategies } from '../hooks/useStrategies';
import { analyticsService } from '../lib/analytics-service';
import { tradeManager } from '../lib/trade-manager';
import { useScreenSize, ITEMS_PER_PAGE } from '../lib/hooks/useScreenSize';

export function StrategyStatus() {
  const { strategies } = useStrategies();
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const screenSize = useScreenSize();
  const navigate = useNavigate();
  const itemsPerPage = ITEMS_PER_PAGE[screenSize];

  const handleStrategyClick = (strategyId: string) => {
    setExpandedStrategy(expandedStrategy === strategyId ? null : strategyId);
  };

  // Calculate pagination
  const totalPages = Math.ceil(strategies.length / itemsPerPage);
  const displayedStrategies = strategies.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Reveal animation variants
  const revealVariants = {
    hidden: { 
      clipPath: 'inset(0 100% 0 0)',
      opacity: 0
    },
    visible: { 
      clipPath: 'inset(0 0 0 0)',
      opacity: 1,
      transition: {
        clipPath: { 
          duration: 0.3,
          delay: 0.3,
          ease: [0.455, 0.03, 0.515, 0.955]
        },
        opacity: {
          duration: 0.3,
          delay: 0.3
        }
      }
    },
    exit: {
      clipPath: 'inset(0 0 0 100%)',
      opacity: 0,
      transition: {
        clipPath: { 
          duration: 0.2,
          ease: [0.455, 0.03, 0.515, 0.955]
        },
        opacity: {
          duration: 0.2
        }
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-neon-raspberry" />
          <h3 className="text-xl font-bold gradient-text">Your Strategies</h3>
        </div>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
          <p className="text-xl text-gray-200 mb-2">No Active Strategies</p>
          <p className="text-gray-400">Create your first strategy to start trading</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {displayedStrategies.map(strategy => {
              const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
              const analytics = analyticsService.getLatestAnalytics(strategy.id);
              const returnRate = analytics?.metrics?.pnl || 0;

              return (
                <motion.div 
                  key={strategy.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-gunmetal-900/30 rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => navigate('/monitor')}
                >
                  <div 
                    className="p-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStrategyClick(strategy.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-200">{strategy.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm px-2 py-0.5 rounded-full ${
                            strategy.status === 'active'
                              ? 'bg-neon-turquoise/20 text-neon-turquoise'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {strategy.status.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-400">•</span>
                          <span className="text-sm text-gray-400">
                            {activeTrades.length} Active {activeTrades.length === 1 ? 'Trade' : 'Trades'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Return Rate</p>
                          <p className={`text-lg font-mono font-bold ${
                            returnRate >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                          }`}>
                            {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
                          </p>
                        </div>
                        <ChevronDown 
                          className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${
                            expandedStrategy === strategy.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {expandedStrategy === strategy.id && (
                        <motion.div
                          variants={revealVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="mt-4 pt-4 border-t border-gunmetal-800"
                        >
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-neon-turquoise" />
                                <span className="text-xs text-gray-400">Active Trades</span>
                              </div>
                              <p className="text-lg font-medium text-neon-turquoise">
                                {activeTrades.length}
                              </p>
                            </div>

                            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="w-4 h-4 text-neon-yellow" />
                                <span className="text-xs text-gray-400">Return Rate</span>
                              </div>
                              <p className={`text-lg font-medium ${returnRate >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
                                {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(1)}%
                              </p>
                            </div>

                            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-neon-orange" />
                                <span className="text-xs text-gray-400">Win Rate</span>
                              </div>
                              <p className="text-lg font-medium text-neon-orange">
                                {(analytics?.metrics?.winRate || 0).toFixed(1)}%
                              </p>
                            </div>

                            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-neon-pink" />
                                <span className="text-xs text-gray-400">Total Trades</span>
                              </div>
                              <p className="text-lg font-medium text-neon-pink">
                                {analytics?.trades?.total || 0}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Dot Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-neon-raspberry w-8'
                  : 'bg-gunmetal-700 hover:bg-gunmetal-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}