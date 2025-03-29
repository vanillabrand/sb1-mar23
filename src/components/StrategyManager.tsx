import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, Plus, Search, Filter, 
  Loader2, AlertCircle 
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useStrategies } from '../hooks/useStrategies';
import { useAuth } from '../hooks/useAuth';
import { CreateStrategyModal } from './CreateStrategyModal';
import { BudgetModal } from './BudgetModal';
import { StrategyCard } from './StrategyCard';
import { StrategyStats } from './StrategyStats';
import { StrategyFilters } from './StrategyFilters';
import { StrategyLibrary } from './StrategyLibrary';
import type { Strategy, SortOption, FilterOptions, CreateStrategyData } from '../lib/types';
import { AuthGuard } from './AuthGuard';

export function StrategyManager() {
  const { user } = useAuth();
  const { strategies, loading, error, refresh, createStrategy } = useStrategies();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('performance');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: 'all',
    riskLevel: 'all',
    performance: 'all'
  });

  // Calculate stats from strategies
  const stats = useMemo(() => {
    if (!strategies?.length) return {
      total: 0,
      active: 0,
      profitable: 0,
      avgPerformance: 0
    };

    const active = strategies.filter(s => s.status === 'active').length;
    const profitable = strategies.filter(s => {
      const performance = s.performance || 0;
      return performance > 0;
    }).length;

    const totalPerformance = strategies.reduce((sum, s) => {
      return sum + (s.performance || 0);
    }, 0);
    
    const avgPerformance = Number((totalPerformance / strategies.length).toFixed(2));

    return {
      total: strategies.length,
      active,
      profitable,
      avgPerformance
    };
  }, [strategies]);

  const handleStrategyCreated = async (strategyData: CreateStrategyData) => {
    if (!user) {
      throw new Error('Please sign in to create a strategy');
    }

    try {
      await createStrategy(strategyData);
      refresh(); // Refresh the strategy list
    } catch (error) {
      console.error('Failed to create strategy:', error);
      throw error; // Let the modal handle the error
    }
  };

  const handleActivateStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowBudgetModal(true);
  };

  const handleBudgetConfirm = async (budget: number) => {
    if (!selectedStrategy) return;
    
    try {
      // Implement your budget confirmation logic here
      setShowBudgetModal(false);
      setSelectedStrategy(null);
      refresh();
    } catch (error) {
      console.error('Failed to set budget:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gunmetal-950 text-gray-100">
      <Toaster position="top-right" />
      
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
                Strategy Manager
              </h1>
              <p className="text-gray-400 mt-2">Create and manage your trading strategies</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              data-testid="new-strategy-btn"
              className="flex items-center gap-2 px-6 py-3 bg-neon-raspberry hover:bg-neon-raspberry/90 rounded-xl font-medium transition-all duration-200 w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5" />
              Create Strategy
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
          <StrategyStats stats={stats} />
        </div>

        {/* Your Strategies Section */}
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50 space-y-6">
          <h2 className="text-xl font-bold gradient-text">Your Strategies</h2>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search strategies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gunmetal-900 rounded-xl border border-gunmetal-700 focus:outline-none focus:border-neon-raspberry"
              />
            </div>
            <StrategyFilters
              options={filterOptions}
              onChange={setFilterOptions}
              onSort={setSortBy}
              currentSort={sortBy}
            />
          </div>

          {/* Strategy Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="flex justify-center py-12 col-span-full">
                <Loader2 className="w-8 h-8 animate-spin text-neon-raspberry" />
              </div>
            ) : error ? (
              <div className="text-center py-12 col-span-full">
                <AlertCircle className="w-12 h-12 text-neon-raspberry mx-auto mb-4" />
                <p className="text-xl text-gray-200">Failed to load strategies</p>
              </div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-12 col-span-full">
                <p className="text-gray-400">No strategies found. Create your first strategy!</p>
              </div>
            ) : (
              strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onActivate={() => handleActivateStrategy(strategy)}
                  onRefresh={refresh}
                />
              ))
            )}
          </div>
        </div>

        {/* Strategy Library Section */}
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50 space-y-6">
          <h2 className="text-xl font-bold gradient-text">Strategy Library</h2>
          <StrategyLibrary onStrategyCreated={refresh} />
        </div>
      </div>

      {/* Modals */}
      <CreateStrategyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleStrategyCreated}
      />
      
      {showBudgetModal && selectedStrategy && (
        <BudgetModal
          strategy={selectedStrategy}
          onClose={() => {
            setShowBudgetModal(false);
            setSelectedStrategy(null);
          }}
          onConfirm={handleBudgetConfirm}
        />
      )}
    </div>
  );
}
