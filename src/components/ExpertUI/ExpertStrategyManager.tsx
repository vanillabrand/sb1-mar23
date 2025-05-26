import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown,
  Sliders,
  BarChart2,
  Code,
  Terminal,
  Download,
  Upload,
  Settings,
  Trash2,
  Copy
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStrategies } from '../../hooks/useStrategies';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
import { StrategyCard } from '../StrategyCard';
import { ExpertCreateStrategyModal } from './ExpertCreateStrategyModal';
import { ExpertStrategyDetails } from './ExpertStrategyDetails';
import { ExpertStrategyAnalytics } from './ExpertStrategyAnalytics';
import { ExpertStrategyImportExport } from './ExpertStrategyImportExport';
import { ExpertStrategyBatchActions } from './ExpertStrategyBatchActions';
import { Strategy } from '../../lib/types';

interface ExpertStrategyManagerProps {
  className?: string;
}

export function ExpertStrategyManager({ className = '' }: ExpertStrategyManagerProps) {
  const { user } = useAuth();
  const { strategies, loading, error: strategiesError, refreshStrategies } = useStrategies();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'paused'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all');
  const [marketTypeFilter, setMarketTypeFilter] = useState<'all' | 'spot' | 'margin' | 'futures'>('all');
  const [sortBy, setSortBy] = useState<'performance' | 'created' | 'name'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [view, setView] = useState<'grid' | 'list' | 'compact'>('grid');

  // Filter and sort strategies
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

    // Apply risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(strategy => 
        (strategy.riskLevel === riskFilter || strategy.risk_level === riskFilter)
      );
    }

    // Apply market type filter
    if (marketTypeFilter !== 'all') {
      filtered = filtered.filter(strategy => 
        (strategy.marketType === marketTypeFilter || strategy.market_type === marketTypeFilter)
      );
    }

    // Sort strategies
    filtered.sort((a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case 'performance':
          valueA = typeof a.performance === 'number' ? a.performance : parseFloat(a.performance as string) || 0;
          valueB = typeof b.performance === 'number' ? b.performance : parseFloat(b.performance as string) || 0;
          break;
        case 'name':
          valueA = (a.title || a.name || '').toLowerCase();
          valueB = (b.title || b.name || '').toLowerCase();
          break;
        case 'created':
        default:
          valueA = new Date(a.created_at).getTime();
          valueB = new Date(b.created_at).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    setFilteredStrategies(filtered);
  }, [strategies, searchTerm, statusFilter, riskFilter, marketTypeFilter, sortBy, sortOrder]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await refreshStrategies();
      await strategySync.initialize();
    } catch (error) {
      logService.log('error', 'Failed to refresh strategies', error, 'ExpertStrategyManager');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStrategies, isRefreshing]);

  // Handle strategy selection
  const handleSelectStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowAnalytics(false);
    setShowImportExport(false);
    setShowBatchActions(false);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedStrategy(null);
    setShowAnalytics(false);
    setShowImportExport(false);
    setShowBatchActions(false);
  };

  // Handle create strategy
  const handleCreateStrategy = () => {
    setShowCreateModal(true);
  };

  // Handle strategy created
  const handleStrategyCreated = (strategy: Strategy) => {
    setShowCreateModal(false);
    refreshStrategies();
  };

  // Handle toggle strategy selection for batch actions
  const handleToggleStrategySelection = (strategyId: string) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        return prev.filter(id => id !== strategyId);
      } else {
        return [...prev, strategyId];
      }
    });
  };

  // Handle select all strategies
  const handleSelectAllStrategies = () => {
    if (selectedStrategies.length === filteredStrategies.length) {
      setSelectedStrategies([]);
    } else {
      setSelectedStrategies(filteredStrategies.map(s => s.id));
    }
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

          <ExpertStrategyDetails 
            strategy={selectedStrategy} 
            onRefresh={refreshStrategies}
          />
        </motion.div>
      </div>
    );
  }

  // If analytics is shown
  if (showAnalytics) {
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

          <ExpertStrategyAnalytics 
            strategies={strategies} 
            onClose={handleBackToList}
          />
        </motion.div>
      </div>
    );
  }

  // If import/export is shown
  if (showImportExport) {
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

          <ExpertStrategyImportExport 
            onImportComplete={handleRefresh}
            onClose={handleBackToList}
          />
        </motion.div>
      </div>
    );
  }

  // If batch actions is shown
  if (showBatchActions) {
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

          <ExpertStrategyBatchActions 
            strategies={strategies.filter(s => selectedStrategies.includes(s.id))}
            onComplete={handleRefresh}
            onClose={handleBackToList}
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
              Advanced strategy management and optimization
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
            
            <button
              onClick={() => setShowAnalytics(true)}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
            >
              <BarChart2 className="w-5 h-5 text-gray-400" />
            </button>
            
            <button
              onClick={() => setShowImportExport(true)}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
            >
              <Code className="w-5 h-5 text-gray-400" />
            </button>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDemoMode ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-neon-green/20 text-neon-green'
            }`}>
              {isDemoMode ? 'Demo Mode' : 'Live Mode'}
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="panel-metallic rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
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
            
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <div className="flex items-center">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="paused">Paused</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
                </div>
              </div>
              
              <div className="relative">
                <div className="flex items-center">
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value as any)}
                    className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
                </div>
              </div>
              
              <div className="relative">
                <div className="flex items-center">
                  <select
                    value={marketTypeFilter}
                    onChange={(e) => setMarketTypeFilter(e.target.value as any)}
                    className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                  >
                    <option value="all">All Market Types</option>
                    <option value="spot">Spot</option>
                    <option value="margin">Margin</option>
                    <option value="futures">Futures</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
                </div>
              </div>
              
              <div className="relative">
                <div className="flex items-center">
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [newSortBy, newSortOrder] = e.target.value.split('-');
                      setSortBy(newSortBy as any);
                      setSortOrder(newSortOrder as any);
                    }}
                    className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                  >
                    <option value="created-desc">Newest First</option>
                    <option value="created-asc">Oldest First</option>
                    <option value="performance-desc">Best Performance</option>
                    <option value="performance-asc">Worst Performance</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllStrategies}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  selectedStrategies.length > 0 ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'bg-gunmetal-800 text-gray-400'
                }`}
              >
                {selectedStrategies.length === filteredStrategies.length ? 'Deselect All' : 'Select All'}
              </button>
              
              {selectedStrategies.length > 0 && (
                <button
                  onClick={() => setShowBatchActions(true)}
                  className="px-3 py-1.5 bg-neon-raspberry/20 text-neon-raspberry rounded-lg text-sm"
                >
                  Batch Actions ({selectedStrategies.length})
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex bg-gunmetal-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 ${view === 'grid' ? 'bg-gunmetal-700' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 ${view === 'list' ? 'bg-gunmetal-700' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('compact')}
                  className={`p-2 ${view === 'compact' ? 'bg-gunmetal-700' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>
              
              <button
                onClick={handleCreateStrategy}
                className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Strategy
              </button>
            </div>
          </div>
        </div>

        {/* Strategies List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
          </div>
        ) : strategiesError ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
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
              Create Strategy
            </button>
          </div>
        ) : (
          <div className={`
            ${view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}
          `}>
            {filteredStrategies.map(strategy => (
              <div key={strategy.id} className="relative">
                {view !== 'compact' && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      id={`select-${strategy.id}`}
                      checked={selectedStrategies.includes(strategy.id)}
                      onChange={() => handleToggleStrategySelection(strategy.id)}
                      className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise focus:ring-offset-gunmetal-800"
                    />
                  </div>
                )}
                
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  isExpanded={false}
                  onToggleExpand={() => handleSelectStrategy(strategy)}
                  onRefresh={handleRefresh}
                  onEdit={() => handleSelectStrategy(strategy)}
                  onDelete={() => {}}
                  hideExpandArrow={false}
                  compact={view === 'compact'}
                />
              </div>
            ))}
          </div>
        )}
      </motion.div>
      
      {/* Create Strategy Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <ExpertCreateStrategyModal
            onClose={() => setShowCreateModal(false)}
            onStrategyCreated={handleStrategyCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
