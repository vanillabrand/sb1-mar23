import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Brain, TrendingUp, GraduationCap, HelpCircle, Plus, ChevronRight, Play, Pause } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatedPanel } from '../AnimatedPanel';
import { EducationalContent } from './EducationalContent';
import { UnifiedBeginnerWorkflow } from './UnifiedBeginnerWorkflow';
import { SimplifiedPortfolioSummary } from '../SimplifiedUI/SimplifiedPortfolioSummary';
import { SimplifiedStrategyCard } from '../SimplifiedUI/SimplifiedStrategyCard';
import { SimplifiedTradeCard } from '../SimplifiedUI/SimplifiedTradeCard';
import { strategySync } from '../../lib/strategy-sync';
import { tradeService } from '../../lib/trade-service';
import { portfolioService } from '../../lib/portfolio-service';
import { demoService } from '../../lib/demo-service';
import { logService } from '../../lib/log-service';
import { supabase } from '../../lib/enhanced-supabase';
import { Strategy, Trade } from '../../lib/types';

export function BeginnerDashboard() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioChange, setPortfolioChange] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showUnifiedWorkflow, setShowUnifiedWorkflow] = useState(false);
  const [activatingStrategy, setActivatingStrategy] = useState<string | null>(null);
  const [deactivatingStrategy, setDeactivatingStrategy] = useState<string | null>(null);

  // Update the date every second
  useEffect(() => {
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(dateInterval);
  }, []);

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
      logService.log('error', 'Failed to load dashboard data', err, 'BeginnerDashboard');
    } finally {
      setLoading(false);
    }
  };

  // Load strategies
  const loadStrategies = async () => {
    try {
      const loadedStrategies = await strategySync.getStrategies();
      setStrategies(loadedStrategies);
    } catch (err) {
      logService.log('error', 'Failed to load strategies', err, 'BeginnerDashboard');
    }
  };

  // Load trades
  const loadTrades = async () => {
    try {
      const loadedTrades = await tradeService.getAllTrades();
      setTrades(loadedTrades);
    } catch (err) {
      logService.log('error', 'Failed to load trades', err, 'BeginnerDashboard');
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
      logService.log('error', 'Failed to load portfolio data', err, 'BeginnerDashboard');

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

  // Toggle unified workflow
  const toggleUnifiedWorkflow = () => {
    setShowUnifiedWorkflow(!showUnifiedWorkflow);
  };

  // Handle strategy activation/deactivation
  const handleStrategyToggle = async (strategy: Strategy) => {
    if (strategy.status === 'active') {
      await handleDeactivateStrategy(strategy.id);
    } else {
      await handleActivateStrategy(strategy.id);
    }
  };

  // Handle strategy activation
  const handleActivateStrategy = async (strategyId: string) => {
    try {
      setActivatingStrategy(strategyId);
      setError(null);

      logService.log('info', `Activating strategy ${strategyId}`, null, 'BeginnerDashboard');

      // Direct database update to avoid API issues
      const { data: activatedStrategy, error: activationError } = await supabase
        .from('strategies')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId)
        .select()
        .single();

      if (activationError) {
        throw activationError;
      }

      if (!activatedStrategy) {
        throw new Error('Failed to activate strategy - no data returned');
      }

      logService.log('info', `Strategy ${strategyId} activated successfully`, null, 'BeginnerDashboard');

      // Refresh strategies
      await loadStrategies();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      logService.log('error', `Failed to activate strategy ${strategyId}`, error, 'BeginnerDashboard');
      setError(errorMessage);
    } finally {
      setActivatingStrategy(null);
    }
  };

  // Handle strategy deactivation
  const handleDeactivateStrategy = async (strategyId: string) => {
    try {
      setDeactivatingStrategy(strategyId);
      setError(null);

      logService.log('info', `Deactivating strategy ${strategyId}`, null, 'BeginnerDashboard');

      // Direct database update to avoid API issues
      const { data: deactivatedStrategy, error: deactivationError } = await supabase
        .from('strategies')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId)
        .select()
        .single();

      if (deactivationError) {
        throw deactivationError;
      }

      if (!deactivatedStrategy) {
        throw new Error('Failed to deactivate strategy - no data returned');
      }

      logService.log('info', `Strategy ${strategyId} deactivated successfully`, null, 'BeginnerDashboard');

      // Refresh strategies
      await loadStrategies();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate strategy';
      logService.log('error', `Failed to deactivate strategy ${strategyId}`, error, 'BeginnerDashboard');
      setError(errorMessage);
    } finally {
      setDeactivatingStrategy(null);
    }
  };

  // Get all strategies for beginners (both active and inactive)
  const allStrategies = strategies;
  const activeStrategies = strategies.filter(s => s.status === 'active');

  // Get recent trades (last 3)
  const recentTrades = trades.slice(0, 3);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 pb-24 sm:pb-8">
      {/* Header with Logo, Date and Demo Mode Indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {/* Logo */}
          <div className="mr-4">
            <img src="/logo.svg" alt="Logo" className="h-10 w-auto" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neon-yellow" />
            <h1 className="text-xl md:text-2xl font-bold gradient-text">
              {currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h1>
          </div>
        </div>

        {/* Demo Mode Indicator */}
        <div className="flex items-center">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isDemoMode ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-neon-green/20 text-neon-green'
          }`}>
            {isDemoMode ? 'Demo Mode' : 'Live Mode'}
          </div>
        </div>
      </div>

      {/* Welcome Message for New Users */}
      {strategies.length === 0 && (
        <AnimatedPanel index={0} className="panel-metallic rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="bg-gunmetal-800 rounded-full p-4">
              <HelpCircle className="w-12 h-12 text-neon-turquoise" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Welcome to Your Trading Journey</h2>
              <p className="text-gray-400 mb-4">
                This beginner-friendly dashboard is designed to help you learn about cryptocurrency trading and get started with your first strategy.
              </p>
              <button
                onClick={toggleUnifiedWorkflow}
                className="px-4 py-2 bg-neon-turquoise text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Your First Strategy
              </button>
            </div>
          </div>
        </AnimatedPanel>
      )}

      {/* Unified Workflow Modal */}
      {showUnifiedWorkflow && (
        <UnifiedBeginnerWorkflow
          onComplete={(strategy) => {
            setShowUnifiedWorkflow(false);
            logService.log('info', 'Strategy created and activated via unified workflow', {
              strategyId: strategy.id,
              name: strategy.title
            }, 'BeginnerDashboard');
            // Refresh strategies list
            loadStrategies();
          }}
          onCancel={() => {
            setShowUnifiedWorkflow(false);
          }}
        />
      )}

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Left Column - Portfolio and Strategies */}
        <div className="lg:col-span-7 space-y-4">
          {/* Portfolio Summary */}
          <AnimatedPanel index={2} className="panel-metallic rounded-xl p-4 md:p-6">
            <SimplifiedPortfolioSummary
              value={portfolioValue}
              change={portfolioChange}
              isDemoMode={isDemoMode}
            />
          </AnimatedPanel>

          {/* Active Strategies */}
          <AnimatedPanel index={3} className="panel-metallic rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-neon-turquoise" />
                <h2 className="text-lg font-bold">Your Strategies</h2>
              </div>
              <button
                onClick={toggleUnifiedWorkflow}
                className="px-3 py-1.5 bg-neon-turquoise text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New Strategy
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
              </div>
            ) : allStrategies.length > 0 ? (
              <div className="space-y-4">
                {allStrategies.map(strategy => (
                  <SimplifiedStrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onViewDetails={() => {}}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gunmetal-900 rounded-lg p-6 text-center">
                <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Strategies Yet</h3>
                <p className="text-gray-500 mb-4">
                  You don't have any trading strategies yet. Create your first strategy to get started!
                </p>
                <button
                  onClick={toggleUnifiedWorkflow}
                  className="px-4 py-2 bg-neon-turquoise text-white rounded-lg hover:bg-opacity-90 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Strategy
                </button>
              </div>
            )}
          </AnimatedPanel>

          {/* Recent Trades */}
          <AnimatedPanel index={4} className="panel-metallic rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-yellow" />
                <h2 className="text-lg font-bold">Recent Trades</h2>
              </div>
              <button
                onClick={() => navigate('/trades')}
                className="text-sm text-neon-yellow flex items-center gap-1 hover:underline"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-yellow"></div>
              </div>
            ) : recentTrades.length > 0 ? (
              <div className="space-y-4">
                {recentTrades.map(trade => (
                  <SimplifiedTradeCard
                    key={trade.id}
                    trade={trade}
                    onViewDetails={() => {}}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gunmetal-900 rounded-lg p-6 text-center">
                <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Recent Trades</h3>
                <p className="text-gray-500">
                  Your trades will appear here once your strategies start trading.
                </p>
              </div>
            )}
          </AnimatedPanel>
        </div>

        {/* Right Column - Educational Content */}
        <div className="lg:col-span-5 space-y-4">
          <AnimatedPanel index={5} className="panel-metallic rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg font-bold">Learning Center</h2>
            </div>
            <EducationalContent />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}
