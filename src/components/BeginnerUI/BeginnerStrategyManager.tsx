import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown,
  Info,
  HelpCircle,
  AlertTriangle,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStrategies } from '../../hooks/useStrategies';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
import { BeginnerStrategyCard } from './BeginnerStrategyCard';
import { BeginnerStrategyWizard } from './BeginnerStrategyWizard';
import { BeginnerStrategyDetails } from './BeginnerStrategyDetails';
import { BeginnerStrategyGuide } from './BeginnerStrategyGuide';
import { BeginnerStrategyTemplates } from './BeginnerStrategyTemplates';
import { Strategy } from '../../lib/types';

interface BeginnerStrategyManagerProps {
  className?: string;
}

export function BeginnerStrategyManager({ className = '' }: BeginnerStrategyManagerProps) {
  const { user } = useAuth();
  const { strategies, loading, error: strategiesError, refreshStrategies } = useStrategies();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());

  // Filter strategies based on search term and status filter
  useEffect(() => {
    if (!strategies) return;

    let filtered = [...strategies];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(strategy => 
        (strategy.title?.toLowerCase().includes(term) || 
         strategy.description?.toLowerCase().includes(term) ||
         (strategy.selected_pairs && strategy.selected_pairs.some(pair => 
           pair.toLowerCase().includes(term)
         )))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(strategy => strategy.status === statusFilter);
    }

    setFilteredStrategies(filtered);
  }, [strategies, searchTerm, statusFilter]);

  // Handle refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await refreshStrategies();
      await strategySync.initialize();
    } catch (error) {
      logService.log('error', 'Failed to refresh strategies', error, 'BeginnerStrategyManager');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle strategy selection
  const handleSelectStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowWizard(false);
    setShowGuide(false);
    setShowTemplates(false);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedStrategy(null);
  };

  // Handle create strategy
  const handleCreateStrategy = () => {
    setShowWizard(true);
    setSelectedStrategy(null);
    setShowGuide(false);
    setShowTemplates(false);
  };

  // Handle show guide
  const handleShowGuide = () => {
    setShowGuide(true);
    setSelectedStrategy(null);
    setShowWizard(false);
    setShowTemplates(false);
  };

  // Handle show templates
  const handleShowTemplates = () => {
    setShowTemplates(true);
    setSelectedStrategy(null);
    setShowWizard(false);
    setShowGuide(false);
  };

  // Handle strategy created
  const handleStrategyCreated = (strategy: Strategy) => {
    setShowWizard(false);
    setSelectedStrategy(strategy);
    refreshStrategies();
  };

  // If a strategy is selected, show its details
  if (selectedStrategy) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Strategies
          </button>

          <BeginnerStrategyDetails 
            strategy={selectedStrategy} 
            onRefresh={refreshStrategies}
          />
        </motion.div>
      </div>
    );
  }

  // If wizard is shown, display the strategy creation wizard
  if (showWizard) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Strategies
          </button>

          <BeginnerStrategyWizard 
            onComplete={handleStrategyCreated} 
            onCancel={handleBackToList}
          />
        </motion.div>
      </div>
    );
  }

  // If guide is shown, display the strategy guide
  if (showGuide) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Strategies
          </button>

          <BeginnerStrategyGuide onClose={handleBackToList} />
        </motion.div>
      </div>
    );
  }

  // If templates is shown, display the strategy templates
  if (showTemplates) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Strategies
          </button>

          <BeginnerStrategyTemplates 
            onSelectTemplate={handleStrategyCreated}
            onCancel={handleBackToList}
          />
        </motion.div>
      </div>
    );
  }

  // Main strategy list view
  return (
    <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-6 h-6 text-neon-turquoise" />
              <h1 className="text-2xl font-bold gradient-text">Strategy Manager</h1>
            </div>
            <p className="text-gray-400">
              Create and manage your trading strategies
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDemoMode ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-neon-green/20 text-neon-green'
            }`}>
              {isDemoMode ? 'Demo Mode' : 'Live Mode'}
            </div>
          </div>
        </div>

        {/* Beginner Guide Banner */}
        <div className="bg-gunmetal-900/50 border border-gunmetal-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-gunmetal-800 rounded-full p-2 mt-1">
              <HelpCircle className="w-5 h-5 text-neon-yellow" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-1">New to Trading Strategies?</h3>
              <p className="text-gray-400 text-sm mb-3">
                Learn how to create effective trading strategies with our beginner-friendly guides and templates.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShowGuide}
                  className="px-3 py-1.5 bg-neon-yellow/20 text-neon-yellow rounded-lg text-sm hover:bg-neon-yellow/30 transition-colors"
                >
                  Strategy Guide
                </button>
                <button
                  onClick={handleShowTemplates}
                  className="px-3 py-1.5 bg-neon-turquoise/20 text-neon-turquoise rounded-lg text-sm hover:bg-neon-turquoise/30 transition-colors"
                >
                  Browse Templates
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search strategies..."
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-gray-500 mr-2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
              >
                <option value="all">All Strategies</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
            </div>
          </div>
          
          <button
            onClick={handleCreateStrategy}
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Strategy
          </button>
        </div>

        {/* Strategies List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
          </div>
        ) : strategiesError ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Error Loading Strategies</h3>
              <p className="text-sm">{strategiesError}</p>
            </div>
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="bg-gunmetal-900/50 rounded-lg p-8 text-center">
            <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Strategies Found</h3>
            <p className="text-gray-400 mb-4">
              {strategies.length === 0 
                ? "You haven't created any strategies yet" 
                : "No strategies match your filters"}
            </p>
            <button
              onClick={handleCreateStrategy}
              className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredStrategies.map(strategy => (
              <BeginnerStrategyCard
                key={strategy.id}
                strategy={strategy}
                onSelect={() => handleSelectStrategy(strategy)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
