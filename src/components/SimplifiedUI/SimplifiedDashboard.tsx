import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  AlertCircle,
  Loader2,
  Plus,
  ArrowRight,
  DollarSign,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { strategySync } from '../../lib/strategy-sync';
import { tradeService } from '../../lib/trade-service';
import { portfolioService } from '../../lib/portfolio-service';
import { portfolioPerformanceService } from '../../lib/portfolio-performance-service';
import { demoService } from '../../lib/demo-service';
import { logService } from '../../lib/log-service';
import { Strategy, Trade } from '../../lib/types';
import { SimplifiedStrategyCard } from './SimplifiedStrategyCard';
import { SimplifiedTradeCard } from './SimplifiedTradeCard';
import { SimplifiedPortfolioSummary } from './SimplifiedPortfolioSummary';

export function SimplifiedDashboard() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioChange, setPortfolioChange] = useState(0);

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();

    // Listen for strategy and trade updates
    document.addEventListener('strategies:updated', handleStrategiesUpdated);
    document.addEventListener('trades:updated', handleTradesUpdated);
    document.addEventListener('demo:changed', handleDemoModeChanged);

    return () => {
      document.removeEventListener('strategies:updated', handleStrategiesUpdated);
      document.removeEventListener('trades:updated', handleTradesUpdated);
      document.removeEventListener('demo:changed', handleDemoModeChanged);
    };
  }, []);

  // Handle strategies updated event
  const handleStrategiesUpdated = () => {
    loadStrategies();
  };

  // Handle trades updated event
  const handleTradesUpdated = () => {
    loadTrades();
  };

  // Handle demo mode changed event
  const handleDemoModeChanged = () => {
    setIsDemoMode(demoService.isDemoMode());
    loadDashboardData();
  };

  // Load all dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadStrategies(),
        loadTrades(),
        loadPortfolioData()
      ]);
    } catch (err) {
      setError('Failed to load dashboard data');
      logService.log('error', 'Failed to load dashboard data', err, 'SimplifiedDashboard');
    } finally {
      setLoading(false);
    }
  };

  // Load strategies
  const loadStrategies = async () => {
    try {
      const allStrategies = strategySync.getAllStrategies();
      // Only show active strategies on dashboard
      const activeStrategies = allStrategies.filter(s => s.status === 'active');
      setStrategies(activeStrategies);
    } catch (err) {
      logService.log('error', 'Failed to load strategies', err, 'SimplifiedDashboard');
    }
  };

  // Load trades
  const loadTrades = async () => {
    try {
      // Get recent trades (last 5)
      const allTrades = await tradeService.getRecentTrades(5);
      setTrades(allTrades);
    } catch (err) {
      logService.log('error', 'Failed to load trades', err, 'SimplifiedDashboard');
    }
  };

  // Load portfolio data
  const loadPortfolioData = async () => {
    try {
      // Initialize portfolio service if needed
      await portfolioService.initialize();

      // Get portfolio summary
      const summary = await portfolioService.getPortfolioSummary();

      if (summary) {
        setPortfolioValue(summary.currentValue || 0);
        setPortfolioChange(summary.totalChange || 0);
      } else {
        // Fallback: calculate from budgets if no portfolio data
        const totalBudgets = Array.from(tradeService.getAllBudgets().values())
          .reduce((sum, budget) => sum + (budget.total || 0), 0);

        setPortfolioValue(totalBudgets);
        setPortfolioChange(0);
      }
    } catch (err) {
      logService.log('error', 'Failed to load portfolio data', err, 'SimplifiedDashboard');

      // Fallback to demo values
      if (isDemoMode) {
        setPortfolioValue(10000); // Demo starting value
        setPortfolioChange(0);
      } else {
        setPortfolioValue(0);
        setPortfolioChange(0);
      }
    }
  };

  // Navigate to create strategy
  const handleCreateStrategy = () => {
    navigate('/strategies?action=create');
  };

  // Navigate to all strategies
  const handleViewAllStrategies = () => {
    navigate('/strategies');
  };

  // Navigate to all trades
  const handleViewAllTrades = () => {
    navigate('/trades');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Portfolio Summary */}
      <SimplifiedPortfolioSummary
        value={portfolioValue}
        change={portfolioChange}
        isDemoMode={isDemoMode}
      />

      {/* Active Strategies Section */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-text">Active Strategies</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCreateStrategy}
              className="flex items-center gap-2 px-3 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              New Strategy
            </button>
            {strategies.length > 0 && (
              <button
                onClick={handleViewAllStrategies}
                className="flex items-center gap-2 px-3 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-all duration-300"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {strategies.length === 0 ? (
          <div className="bg-gunmetal-800/50 rounded-lg p-6 text-center">
            <Brain className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Active Strategies</h3>
            <p className="text-gray-400 mb-4">Create your first strategy to start trading</p>
            <button
              onClick={handleCreateStrategy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Create Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.slice(0, 4).map(strategy => (
              <SimplifiedStrategyCard
                key={strategy.id}
                strategy={strategy}
                compact={true}
                onViewDetails={() => navigate(`/strategies?id=${strategy.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Trades Section */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-text">Recent Trades</h2>
          {trades.length > 0 && (
            <button
              onClick={handleViewAllTrades}
              className="flex items-center gap-2 px-3 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-all duration-300"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {trades.length === 0 ? (
          <div className="bg-gunmetal-800/50 rounded-lg p-6 text-center">
            <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Recent Trades</h3>
            <p className="text-gray-400">Trades will appear here once your strategies start trading</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(trade => (
              <SimplifiedTradeCard
                key={trade.id}
                trade={trade}
                onViewDetails={() => navigate(`/trades?id=${trade.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
