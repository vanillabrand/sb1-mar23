import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Search, Filter, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useStrategies } from '../hooks/useStrategies';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase-client';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { strategySync } from '../lib/strategy-sync';
import { marketService } from '../lib/market-service';
import { tradeManager } from '../lib/trade-manager';
import { CreateStrategyModal } from './CreateStrategyModal';
import { BudgetModal } from './BudgetModal';
import { StrategyCard } from './StrategyCard';
import { StrategyStats } from './StrategyStats';
import { StrategyFilters } from './StrategyFilters';
import { StrategyLibrary } from './StrategyLibrary';
import { EmptyState } from './ui/EmptyState';
import { LoadingSpinner } from './LoadingStates';
import { Pagination } from './ui/Pagination';
import type {
  Strategy,
  SortOption,
  FilterOptions,
  CreateStrategyData,
  StrategyStatus
} from '../types';
import { templateService } from '../lib/template-service';
import { templateGenerator } from '../lib/template-generator';
import type { StrategyTemplate, StrategyBudget } from '../lib/types';
import { strategyService } from '../lib/strategy-service';
import { tradeService } from '../lib/trade-service';
import { tradeGenerator } from '../lib/trade-generator';
import { strategyMonitor } from '../lib/strategy-monitor';
import { tradeEngine } from '../lib/trade-engine';

interface StrategyManagerProps {
  className?: string;
}

export function StrategyManager({ className }: StrategyManagerProps) {
  const { user } = useAuth();
  const { strategies, loading, error: strategiesError, refreshStrategies, createStrategy } = useStrategies();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add these state variables
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Initialize with empty arrays to prevent undefined
  const [paginatedStrategies, setPaginatedStrategies] = useState<Strategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);

  // All state declarations grouped together at the top
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('performance');
  const [currentPage, setCurrentPage] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: 'all',
    riskLevel: 'all',
    performance: 'all'
  });
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 4;

  // Add event listener for budget modal
  useEffect(() => {
    const handleShowBudgetModal = (event: CustomEvent) => {
      setSelectedStrategy(event.detail.strategy);
      setShowBudgetModal(true);
    };

    window.addEventListener('showBudgetModal', handleShowBudgetModal as EventListener);

    return () => {
      window.removeEventListener('showBudgetModal', handleShowBudgetModal as EventListener);
    };
  }, []);

  // Update filtered strategies whenever dependencies change
  useEffect(() => {
    if (!strategies) return;

    const filtered = strategies
      .filter(strategy => {
        if (searchTerm && !strategy.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        if (filterOptions.status !== 'all' && strategy.status !== filterOptions.status) {
          return false;
        }

        if (filterOptions.riskLevel !== 'all' && strategy.riskLevel !== filterOptions.riskLevel) {
          return false;
        }

        if (filterOptions.performance !== 'all') {
          const performance = parseFloat(strategy.performance);
          switch (filterOptions.performance) {
            case 'positive': return performance > 0;
            case 'negative': return performance < 0;
            default: return true;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'performance':
            return parseFloat(b.performance) - parseFloat(a.performance);
          case 'created':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case 'name':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });

    setFilteredStrategies(filtered);
  }, [strategies, searchTerm, filterOptions, sortBy]);

  // Update paginated strategies whenever filtered strategies or page changes
  useEffect(() => {
    const paginated = filteredStrategies.slice(
      currentPage * ITEMS_PER_PAGE,
      (currentPage + 1) * ITEMS_PER_PAGE
    );
    setPaginatedStrategies(paginated);
  }, [filteredStrategies, currentPage, ITEMS_PER_PAGE]);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);

      const loadedTemplates = await templateService.getTemplates();
      setTemplates(loadedTemplates || []);
    } catch (error) {
      setTemplateError('Failed to load templates');
      logService.log('error', 'Failed to load templates', error, 'StrategyManager');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const totalPages = Math.ceil((filteredStrategies?.length || 0) / ITEMS_PER_PAGE);

  // Handlers
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await Promise.all([
        refreshStrategies(),
        strategySync.initialize(),
        marketService.syncStrategies(),
        tradeManager.syncTrades()
      ]);
    } catch (error) {
      logService.log('error', 'Failed to refresh strategies', error, 'StrategyManager');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStrategies, isRefreshing]);

  const handleStrategyCreate = async (strategyData: CreateStrategyData) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      setIsRefreshing(true);

      const enrichedData = {
        ...strategyData,
        type: strategyData.type || 'custom', // Ensure type is set
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await createStrategy(enrichedData);
      setShowCreateModal(false);
      await refreshStrategies(); // Force refresh after creation
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'StrategyManager');
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStrategySelect = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowBudgetModal(true);
  };

  const handleEditStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowEditModal(true);
  };

  const handleDeleteStrategy = async (strategy: Strategy) => {
    try {
      setIsDeleting(true);
      setError(null);

      // Deactivate if active
      if (strategy.status === 'active') {
        await handleDeactivateStrategy(strategy);
      }

      // Delete the strategy
      await strategyService.deleteStrategy(strategy.id);

      // Refresh the list
      await refreshStrategies();

      logService.log('info', `Strategy ${strategy.id} deleted successfully`, null, 'StrategyManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to delete strategy', error, 'StrategyManager');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilterOptions(newFilters);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
  };

  const handleUseTemplate = async (template: StrategyTemplate) => {
    try {
      await templateGenerator.copyTemplateToStrategy(template.id);
      // Refresh strategies list after creating new strategy
      await refreshStrategies();
    } catch (err) {
      logService.log('error', 'Failed to create strategy from template:', err, 'StrategyManager');
    }
  };

  const handleActivateStrategy = async (strategy: Strategy) => {
    try {
      setError(null);
      setLoadingStrategy(strategy.id);

      // Check if budget is already set
      const budget = await tradeService.getBudget(strategy.id);

      if (!budget) {
        // If no budget, show budget modal
        setSelectedStrategy(strategy);
        setShowBudgetModal(true);
        return;
      }

      // If budget exists, proceed with full activation
      await activateStrategyWithBudget(strategy, budget);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to activate strategy', error, 'StrategyManager');
    } finally {
      setLoadingStrategy(null);
    }
  };

  const activateStrategyWithBudget = async (strategy: Strategy, budget: any) => {
    try {
      // 1. Activate strategy in database
      await strategyService.activateStrategy(strategy.id);

      // 2. Start market monitoring
      await marketService.startStrategyMonitoring(strategy);

      // 3. Add strategy to trade generator
      await tradeGenerator.addStrategy(strategy);

      // 4. Initialize strategy monitoring
      await strategyMonitor.addStrategy(strategy);

      // 5. Start trade engine monitoring
      await tradeEngine.addStrategy(strategy);

      // 6. Refresh data
      await handleRefresh();

      logService.log('info', `Strategy ${strategy.id} activated with budget`,
        { strategy, budget }, 'StrategyManager');

    } catch (error) {
      throw error;
    }
  };

  const handleDeactivateStrategy = async (strategy: Strategy) => {
    try {
      setError(null);
      await strategyService.deactivateStrategy(strategy.id);
      await handleRefresh();

      logService.log('info', `Strategy ${strategy.id} deactivated`, strategy, 'StrategyManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to deactivate strategy', error, 'StrategyManager');
    }
  };

  const handleBudgetSubmit = async (budgetAmount: number) => {
    if (!selectedStrategy) return;

    try {
      setIsSubmittingBudget(true);
      setError(null);

      // 1. Set budget
      const budget: StrategyBudget = {
        total: budgetAmount,
        allocated: 0,
        available: budgetAmount,
        maxPositionSize: budgetAmount * 0.1 // Default to 10% of total budget
      };

      await tradeService.setBudget(selectedStrategy.id, budget);

      // 2. Proceed with full activation
      await activateStrategyWithBudget(selectedStrategy, budget);

      setShowBudgetModal(false);
      setSelectedStrategy(null);

      logService.log('info', 'Strategy activated with budget',
        { strategy: selectedStrategy, budget },
        'StrategyManager'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to activate strategy with budget', error, 'StrategyManager');

      // Clean up on failure
      if (selectedStrategy) {
        await tradeService.setBudget(selectedStrategy.id, null);
      }
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  // Effects
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('strategy:created', handleRefresh);

    const subscription = supabase
      .channel('strategy_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'strategies'
      }, handleRefresh)
      .subscribe();

    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, [handleRefresh]);

  // Add effect for realtime updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategies',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refreshStrategies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, refreshStrategies]);

  return (
    <>
      <div className="min-h-screen bg-gunmetal-950">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold gradient-text">Strategy Manager</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={loadTemplates}
                className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-all duration-300"
                disabled={loadingTemplates}
              >
                {loadingTemplates ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh Templates
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                Create Strategy
              </button>
            </div>
          </div>

          {/* Stats */}
          <StrategyStats strategies={strategies} className="mb-8" />

          {/* Filters Section */}
          <div className="bg-gunmetal-900/50 rounded-xl p-6 mb-8 border border-gunmetal-700/50">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search strategies..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 bg-gunmetal-800/50 rounded-lg border border-gunmetal-700 focus:border-neon-turquoise focus:outline-none"
                />
              </div>

              <StrategyFilters
                options={filterOptions}
                onChange={handleFilterChange}
                onSortChange={handleSortChange}
                sortBy={sortBy}
              />
            </div>
          </div>

          {/* Templates Section */}
          {loadingTemplates ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
            </div>
          ) : templateError ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              {templateError}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700">
                <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
                <p className="text-xl text-gray-200 mb-2">No Templates Available</p>
                <p className="text-gray-400">Check back later for new strategy templates</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700 hover:bg-gunmetal-800/50 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-raspberry">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-200">{template.title}</h3>
                      <span className="text-sm text-neon-raspberry">
                        {template.riskLevel}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-400 mb-4">{template.description}</p>

                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm">
                      <span className="text-gray-400">Win Rate: </span>
                      <span className="text-neon-turquoise">
                        {template.metrics?.winRate
                          ? `${Number(template.metrics.winRate).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="flex items-center gap-2 px-4 py-2 bg-gunmetal-900 text-gray-200 rounded-lg hover:text-neon-turquoise transition-all duration-300"
                    >
                      <Plus className="w-4 h-4" />
                      Use Template
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Strategies Section */}
          <div className="bg-gunmetal-900/50 rounded-xl p-6 border border-gunmetal-700/50">
            <h2 className="text-xl font-semibold text-gray-200 mb-6">Your Strategies</h2>

            {/* Content */}
            {loading ? (
              <LoadingSpinner className="mx-auto" />
            ) : strategiesError ? (
              <EmptyState
                icon={AlertCircle}
                title="Error loading strategies"
                description="Please try refreshing the page"
                action={{
                  label: 'Retry',
                  onClick: handleRefresh
                }}
              />
            ) : (filteredStrategies?.length || 0) === 0 ? (
              <EmptyState
                icon={Brain}
                title="No strategies found"
                description={searchTerm ? "Try adjusting your search" : "Create your first strategy"}
                action={{
                  label: 'Create Strategy',
                  onClick: () => setShowCreateModal(true)
                }}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {(paginatedStrategies || []).map((strategy) => (
                    <motion.div
                      key={strategy.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onRefresh={refreshStrategies}
                        onEdit={handleEditStrategy}
                        onDelete={handleDeleteStrategy}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={ITEMS_PER_PAGE}
                    totalItems={filteredStrategies?.length || 0}
                    showPageNumbers={true}
                    className="mt-6"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Create Strategy Modal */}
        {showCreateModal && (
          <CreateStrategyModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleStrategyCreate}
          />
        )}

        {/* Budget Modal */}
        {showBudgetModal && selectedStrategy && (
          <BudgetModal
            onConfirm={handleBudgetSubmit}
            onCancel={() => {
              setShowBudgetModal(false);
              setSelectedStrategy(null);
            }}
            maxBudget={tradeService.calculateAvailableBudget()}
            riskLevel={selectedStrategy.riskLevel}
            isSubmitting={isSubmittingBudget}
          />
        )}
      </div>
    </>
  );
}
