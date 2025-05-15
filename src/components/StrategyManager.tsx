import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CollapsibleDescription } from './CollapsibleDescription';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUpVariants, cardVariants, staggerContainerVariants, buttonVariants, controlsVariants } from '../lib/animation-utils';
import { SwipeAnimation } from './ui/SwipeAnimation';
import { Brain, Plus, Search, Filter, Loader2, AlertCircle, RefreshCw, BarChart3, Monitor } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useStrategies } from '../hooks/useStrategies';
import { useAuth } from '../hooks/useAuth';
import { useScreenSize } from '../lib/hooks/useScreenSize';
import { supabase } from '../lib/supabase';
import { directDeleteStrategy } from '../lib/direct-delete';
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
import { MetallicPagination } from './ui/MetallicPagination';
import { SwipeableCardList } from './ui/SwipeableCardList';
import { AssetDisplayPanel } from './AssetDisplayPanel';
import { RiskLevelBadge } from './risk/RiskLevelBadge';
import type {
  Strategy,
  SortOption,
  FilterOptions,
  CreateStrategyData,
  StrategyStatus
} from '../lib/types';
import { templateService } from '../lib/template-service';
import { templateGenerator } from '../lib/template-generator';
import { templateManager } from '../lib/template-manager';
import type { StrategyTemplate, StrategyBudget } from '../lib/types';
import { strategyService } from '../lib/strategy-service';
import { tradeService } from '../lib/trade-service';
import { tradeGenerator } from '../lib/trade-generator';
import { strategyMonitor } from '../lib/strategy-monitor';
import { tradeEngine } from '../lib/trade-engine';
import { walletBalanceService } from '../lib/wallet-balance-service';

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
  const [filteredTemplates, setFilteredTemplates] = useState<StrategyTemplate[]>([]);
  const [paginatedTemplates, setPaginatedTemplates] = useState<StrategyTemplate[]>([]);
  const [templatePage, setTemplatePage] = useState(0);

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
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('performance');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: 'all',
    riskLevel: 'all',
    performance: 'all'
  });
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState<string | null>(null);

  // Get screen size for responsive pagination
  const screenSize = useScreenSize();

  // Constants for pagination
  const [ITEMS_PER_PAGE, setItemsPerPage] = useState(screenSize === 'sm' ? 3 : 6); // For user strategies
  const [TEMPLATES_PER_PAGE, setTemplatesPerPage] = useState(screenSize === 'sm' ? 3 : 6); // For template strategies

  // Update items per page when screen size changes
  useEffect(() => {
    setItemsPerPage(screenSize === 'sm' ? 3 : 6);
    setTemplatesPerPage(screenSize === 'sm' ? 3 : 6);
  }, [screenSize]);

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

  // Initial refresh of strategies
  useEffect(() => {
    // Initial refresh
    refreshStrategies();
  }, [refreshStrategies]);

  // Define the handlePageChange function
  const handlePageChange = useCallback((newPage: number) => {
    console.log(`Changing to page ${newPage}`);
    setCurrentPage(newPage);
  }, []);

  // Add comprehensive event listeners for strategy changes
  useEffect(() => {
    const handleStrategyRemove = (event: Event) => {
      const customEvent = event as CustomEvent;
      const strategyId = customEvent.detail?.id;

      if (strategyId && strategies) {
        console.log('Strategy removal event received:', strategyId);

        // Immediately update the UI
        if (strategies) {
          // Update filtered strategies directly
          setFilteredStrategies(prevStrategies => {
            const updated = prevStrategies.filter(s => s.id !== strategyId);
            console.log(`UI updated: Removed strategy ${strategyId} from filtered list`);
            return updated;
          });

          // Also update paginated strategies
          setPaginatedStrategies(prevStrategies => {
            const updated = prevStrategies.filter(s => s.id !== strategyId);
            console.log(`UI updated: Removed strategy ${strategyId} from paginated list`);
            return updated;
          });
        }

        // Force a refresh of the pagination
        handlePageChange(1);

        // Force a refresh to ensure everything is in sync
        setTimeout(() => {
          refreshStrategies();
        }, 500);
      }
    };

    const handleStrategyUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedStrategy = customEvent.detail?.strategy;

      if (updatedStrategy && strategies) {
        console.log('Strategy update event received:', updatedStrategy.id);

        // Update filtered strategies
        setFilteredStrategies(prevFiltered => {
          return prevFiltered.map(s =>
            s.id === updatedStrategy.id ? updatedStrategy : s
          );
        });

        // Update paginated strategies
        setPaginatedStrategies(prevPaginated => {
          return prevPaginated.map(s =>
            s.id === updatedStrategy.id ? updatedStrategy : s
          );
        });

        // Force a refresh to ensure everything is in sync
        setTimeout(() => {
          refreshStrategies();
        }, 500);
      }
    };

    const handleStrategyCreate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newStrategy = customEvent.detail?.strategy;

      if (newStrategy) {
        console.log('Strategy creation event received:', newStrategy.id);

        // Directly update the strategies state
        if (strategies) {
          // Update filtered strategies
          setFilteredStrategies(prevFiltered => {
            // Only add if not already in the list
            if (!prevFiltered.some(s => s.id === newStrategy.id)) {
              console.log(`Adding new strategy ${newStrategy.id} to filtered list`);
              return [...prevFiltered, newStrategy];
            }
            return prevFiltered;
          });

          // Update paginated strategies to show the new strategy immediately
          setPaginatedStrategies(prevPaginated => {
            // Only add if not already in the list
            if (!prevPaginated.some(s => s.id === newStrategy.id)) {
              console.log(`Adding new strategy ${newStrategy.id} to paginated list`);
              // Always add to the current page for immediate visibility
              return [...prevPaginated, newStrategy];
            }
            return prevPaginated;
          });

          // Force a re-render by updating the current page
          setCurrentPage(currentPage);
        }

        // Force a refresh to ensure everything is in sync
        refreshStrategies();
      }
    };

    const handleStrategiesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedStrategies = customEvent.detail?.strategies;

      if (updatedStrategies) {
        console.log('Strategies list update event received:', updatedStrategies.length, 'strategies');

        // Immediately update the UI with the new strategies
        setFilteredStrategies(updatedStrategies);

        // Force a refresh to ensure everything is in sync
        setTimeout(() => {
          refreshStrategies();
        }, 500);
      }
    };

    // Add the event listeners
    document.addEventListener('strategy:remove', handleStrategyRemove);
    document.addEventListener('strategy:update', handleStrategyUpdate);
    document.addEventListener('strategy:created', handleStrategyCreate);
    document.addEventListener('strategies:updated', handleStrategiesUpdated);

    // Also subscribe to event bus events
    const unsubscribeRemove = eventBus.subscribe('strategy:deleted', ({ strategyId }) => {
      console.log('Event bus strategy:deleted received:', strategyId);
      handleStrategyRemove(new CustomEvent('strategy:remove', { detail: { id: strategyId } }));
    });

    const unsubscribeUpdate = eventBus.subscribe('strategy:updated', ({ strategy }) => {
      console.log('Event bus strategy:updated received:', strategy.id);
      handleStrategyUpdate(new CustomEvent('strategy:update', { detail: { strategy } }));
    });

    const unsubscribeCreate = eventBus.subscribe('strategy:created', (strategy) => {
      console.log('Event bus strategy:created received:', strategy.id);
      handleStrategyCreate(new CustomEvent('strategy:created', { detail: { strategy } }));
    });

    const unsubscribeStrategiesUpdated = eventBus.subscribe('strategies:updated', (strategies) => {
      console.log('Event bus strategies:updated received:', strategies.length, 'strategies');
      handleStrategiesUpdated(new CustomEvent('strategies:updated', { detail: { strategies } }));
    });

    return () => {
      // Remove the event listeners
      document.removeEventListener('strategy:remove', handleStrategyRemove);
      document.removeEventListener('strategy:update', handleStrategyUpdate);
      document.removeEventListener('strategy:created', handleStrategyCreate);
      document.removeEventListener('strategies:updated', handleStrategiesUpdated);

      // Unsubscribe from event bus
      unsubscribeRemove();
      unsubscribeUpdate();
      unsubscribeCreate();
      unsubscribeStrategiesUpdated();
    };
  }, [strategies, refreshStrategies]);

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
        // Always sort by creation date first (newest first), then apply additional sorting
        const dateComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        // If sortBy is 'created', just use the date comparison
        if (sortBy === 'created') {
          return dateComparison;
        }

        // Otherwise, apply the selected sort criteria
        switch (sortBy) {
          case 'performance':
            return parseFloat(b.performance) - parseFloat(a.performance);
          case 'name':
            return a.title.localeCompare(b.title);
          default:
            return dateComparison; // Default to newest first
        }
      });

    setFilteredStrategies(filtered);
  }, [strategies, searchTerm, filterOptions, sortBy]);

  // Listen for strategy deleted events from other components
  useEffect(() => {
    const handleStrategyDeleted = (data: { strategyId: string }) => {
      // Update local state to immediately remove the strategy from the list
      if (strategies) {
        const updatedStrategies = strategies.filter(s => s.id !== data.strategyId);
        // Update the strategies state through the event bus to ensure all components are updated
        eventBus.emit('strategies:updated', updatedStrategies);
      }
    };

    // Subscribe to the strategy:deleted event
    const unsubscribe = eventBus.subscribe('strategy:deleted', handleStrategyDeleted);

    return () => {
      // Clean up the subscription when the component unmounts
      unsubscribe();
    };
  }, [strategies]);

  // Update paginated strategies whenever filtered strategies or page changes
  useEffect(() => {
    const paginated = filteredStrategies.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
    setPaginatedStrategies(paginated);
  }, [filteredStrategies, currentPage, ITEMS_PER_PAGE]);

  // Update paginated templates whenever filtered templates or template page changes
  useEffect(() => {
    const paginated = filteredTemplates.slice(
      templatePage * TEMPLATES_PER_PAGE,
      (templatePage + 1) * TEMPLATES_PER_PAGE
    );
    setPaginatedTemplates(paginated);
  }, [filteredTemplates, templatePage, TEMPLATES_PER_PAGE]);

  // Update filtered templates whenever templates or search term changes
  useEffect(() => {
    if (templateSearchTerm.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const filtered = templates.filter(template =>
        template.title.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(templateSearchTerm.toLowerCase()))
      );
      setFilteredTemplates(filtered);
    }
  }, [templates, templateSearchTerm]);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Set up real-time updates for templates
  useEffect(() => {
    const templateUpdateInterval = setInterval(() => {
      if (!loadingTemplates) {
        loadTemplates();
      }
    }, 60000); // Update templates every minute

    return () => clearInterval(templateUpdateInterval);
  }, [loadingTemplates]);

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

  const handleRegenerateTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);

      // Clear and regenerate templates
      await templateManager.clearAndRegenerateTemplates();

      // Reload templates
      await loadTemplates();

      logService.log('info', 'Successfully regenerated templates', null, 'StrategyManager');
    } catch (error) {
      setTemplateError('Failed to regenerate templates');
      logService.log('error', 'Failed to regenerate templates', error, 'StrategyManager');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const totalPages = Math.ceil((filteredStrategies?.length || 0) / ITEMS_PER_PAGE);
  const totalTemplatePages = Math.ceil((filteredTemplates?.length || 0) / TEMPLATES_PER_PAGE);

  // Handlers
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await refreshStrategies();
      await strategySync.initialize();
      // Refresh wallet balances
      await walletBalanceService.refreshBalances();
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
      setError(null); // Clear any previous errors

      // Properly capitalize the strategy title
      const capitalizedTitle = strategyData.title
        ? strategyData.title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        : 'New Strategy';

      // Format selected pairs to ensure they use the correct format (BTC/USDT instead of BTC_USDT)
      const formattedPairs = Array.isArray(strategyData.selected_pairs)
        ? strategyData.selected_pairs.map(pair => pair.includes('_') ? pair.replace('_', '/') : pair)
        : ['BTC/USDT'];

      // Ensure all required fields are properly set
      const enrichedData = {
        ...strategyData,
        title: capitalizedTitle, // Use capitalized title
        name: strategyData.name || capitalizedTitle, // Use capitalized title as fallback for name
        type: strategyData.type || 'custom', // Ensure type is set
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ensure risk_level is properly set (both camelCase and snake_case versions)
        risk_level: strategyData.risk_level || 'Medium',
        riskLevel: strategyData.risk_level || 'Medium',
        // Ensure selected_pairs is properly set and formatted correctly
        selected_pairs: formattedPairs,
        // Ensure market_type is properly set (database field)
        market_type: strategyData.marketType || 'spot',
        // Also set marketType for UI components
        marketType: strategyData.marketType || 'spot',
        // Ensure status is set
        status: 'inactive'
      };

      logService.log('info', 'Creating strategy with enriched data', enrichedData, 'StrategyManager');

      // Create the strategy
      let newStrategy;

      try {
        // Create a minimal strategy object with only essential fields
        const minimalStrategy = {
          id: uuidv4(),
          name: capitalizedTitle,
          title: capitalizedTitle,
          description: enrichedData.description || '',
          user_id: user.id,
          status: 'inactive',
          risk_level: enrichedData.risk_level || 'Medium',
          market_type: enrichedData.marketType || enrichedData.market_type || 'spot',
          selected_pairs: formattedPairs,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          type: 'custom'
        };

        logService.log('info', 'Creating minimal strategy', minimalStrategy, 'StrategyManager');

        // Direct creation with supabase
        const { data: directStrategy, error } = await supabase
          .from('strategies')
          .insert(minimalStrategy)
          .select()
          .single();

        if (error) {
          logService.log('error', 'Error with direct strategy creation', error, 'StrategyManager');
          throw error;
        }

        newStrategy = directStrategy;
        logService.log('info', `Strategy created successfully with ID: ${newStrategy?.id}`, null, 'StrategyManager');
      } catch (createError) {
        logService.log('error', 'All strategy creation attempts failed', createError, 'StrategyManager');
        throw new Error('Failed to create strategy after multiple attempts');
      }

      // Check if newStrategy is null or undefined
      if (!newStrategy) {
        throw new Error('Failed to create strategy - no data returned');
      }

      logService.log('info', `Strategy created successfully with ID: ${newStrategy.id}`, null, 'StrategyManager');

      // Close the modal
      setShowCreateModal(false);

      // Add the strategy to all lists for immediate visibility
      if (newStrategy) {
        // 1. Add to the strategy sync cache first
        if (!strategySync.hasStrategy(newStrategy.id)) {
          strategySync.addStrategyToCache(newStrategy);
          logService.log('info', `Added strategy ${newStrategy.id} to strategy sync cache`, null, 'StrategyManager');
        }

        // 2. Update filtered strategies
        setFilteredStrategies(prev => {
          if (!prev.some(s => s.id === newStrategy.id)) {
            return [...prev, newStrategy];
          }
          return prev;
        });

        // 3. Update paginated strategies
        setPaginatedStrategies(prev => {
          if (!prev.some(s => s.id === newStrategy.id)) {
            return [...prev, newStrategy];
          }
          return prev;
        });

        // 4. Force a re-render by updating the current page
        setCurrentPage(currentPage);

        // 5. Emit events to update all components
        eventBus.emit('strategy:created', newStrategy);
        eventBus.emit('strategy:created', { strategy: newStrategy }); // Also emit with object wrapper for compatibility

        document.dispatchEvent(new CustomEvent('strategy:created', {
          detail: { strategy: newStrategy }
        }));

        // 6. Force a broadcast of all strategies
        strategySync.broadcastStrategiesUpdate();
      }

      // 7. Refresh strategies to ensure everything is in sync
      try {
        await refreshStrategies();
        logService.log('info', 'Strategy list refreshed after creation', null, 'StrategyManager');
      } catch (refreshError) {
        logService.log('error', 'Error refreshing strategies after creation', refreshError, 'StrategyManager');
      }

      // 8. Double-check that the strategy is in the lists after a short delay
      setTimeout(async () => {
        // Check if the strategy is in the filtered list
        const isInFiltered = filteredStrategies.some(s => s.id === newStrategy.id);
        if (!isInFiltered) {
          setFilteredStrategies(prev => [...prev, newStrategy]);
          logService.log('info', `Added strategy ${newStrategy.id} to filtered list in delayed check`, null, 'StrategyManager');
        }

        // Check if the strategy is in the paginated list
        const isInPaginated = paginatedStrategies.some(s => s.id === newStrategy.id);
        if (!isInPaginated) {
          setPaginatedStrategies(prev => [...prev, newStrategy]);
          logService.log('info', `Added strategy ${newStrategy.id} to paginated list in delayed check`, null, 'StrategyManager');
        }

        // Force another refresh
        try {
          await refreshStrategies();
          logService.log('info', 'Second strategy refresh completed', null, 'StrategyManager');
        } catch (refreshError) {
          logService.log('error', 'Error in second strategy refresh', refreshError, 'StrategyManager');
        }
      }, 500);
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

      // 1. If strategy is active, deactivate it first
      if (strategy.status === 'active') {
        setError('Cannot delete an active strategy. Please deactivate it first.');
        setIsDeleting(false);
        return;
      }

      console.log('DELETION - Strategy ID:', strategy.id);

      // 2. Store the strategy ID for later use
      const strategyId = strategy.id;

      // 3. Immediately update the UI for instant feedback
      if (strategies) {
        // Update filtered strategies directly
        setFilteredStrategies(prevStrategies => {
          const updated = prevStrategies.filter(s => s.id !== strategyId);
          console.log(`UI updated: Removed strategy ${strategyId} from filtered list`);
          return updated;
        });

        // Also update paginated strategies
        setPaginatedStrategies(prevStrategies => {
          const updated = prevStrategies.filter(s => s.id !== strategyId);
          console.log(`UI updated: Removed strategy ${strategyId} from paginated list`);
          return updated;
        });
      }

      // 4. Completely stop the strategy sync system
      console.log('Stopping strategy sync during deletion');
      strategySync.pauseSync();

      // 5. Remove the strategy from the strategy sync cache
      if (strategySync.hasStrategy(strategyId)) {
        console.log(`Manually removing strategy ${strategyId} from strategy sync cache`);
        strategySync.removeStrategyFromCache(strategyId);
      }

      try {
        // 6. Use the strategy service to delete the strategy
        console.log(`Using strategy service to delete strategy ${strategyId}...`);
        await strategyService.deleteStrategy(strategyId);
        console.log(`Strategy ${strategyId} successfully deleted from database`);
      } catch (deleteError) {
        console.error(`Error using strategy service: ${deleteError}`);

        // 7. Fallback to direct deletion if strategy service fails
        console.log(`Falling back to direct deletion for strategy ${strategyId}...`);
        const success = await directDeleteStrategy(strategyId);

        if (!success) {
          console.error(`Failed to delete strategy ${strategyId} from database, trying alternative methods`);

          // Try deleting trades first to avoid foreign key constraints
          try {
            console.log(`Deleting trades for strategy ${strategyId}`);
            const { error: tradesError } = await supabase
              .from('trades')
              .delete()
              .eq('strategy_id', strategyId);

            if (tradesError) {
              console.warn(`Error deleting trades: ${tradesError.message}`);
            } else {
              console.log(`Successfully deleted all trades for strategy ${strategyId}`);
            }
          } catch (tradesError) {
            console.warn(`Exception deleting trades: ${tradesError}`);
          }

          // Try direct strategy deletion
          try {
            console.log(`Deleting strategy ${strategyId} directly`);
            const { error: strategyError } = await supabase
              .from('strategies')
              .delete()
              .eq('id', strategyId);

            if (strategyError) {
              console.error(`Error deleting strategy: ${strategyError.message}`);

              // Last resort: Try with a direct SQL query
              try {
                console.log(`Attempting direct SQL query as last resort...`);
                await supabase.rpc('execute_sql', {
                  query: `
                    DELETE FROM trades WHERE strategy_id = '${strategyId}';
                    DELETE FROM strategies WHERE id = '${strategyId}';
                  `
                });
                console.log(`Direct SQL query executed for strategy ${strategyId}`);
              } catch (sqlError) {
                console.error(`Final SQL attempt failed: ${sqlError}`);
              }
            } else {
              console.log(`Successfully deleted strategy ${strategyId} directly`);
            }
          } catch (strategyError) {
            console.error(`Exception deleting strategy: ${strategyError}`);
          }
        }
      }

      // 8. Broadcast the deletion event for other components
      eventBus.emit('strategy:deleted', { strategyId });
      document.dispatchEvent(new CustomEvent('strategy:remove', {
        detail: { id: strategyId }
      }));

      // 9. Force a complete refresh of the strategies list
      // But first, make sure the strategy is removed from the cache
      if (strategySync.hasStrategy(strategyId)) {
        console.log(`Strategy ${strategyId} still in cache, removing again`);
        strategySync.removeStrategyFromCache(strategyId);
      }

      console.log('Refreshing strategies list after deletion');
      await refreshStrategies();

      // 10. Double-check that the strategy is gone
      if (strategySync.hasStrategy(strategyId)) {
        console.log(`Strategy ${strategyId} STILL in cache after refresh, forcing removal`);
        strategySync.removeStrategyFromCache(strategyId);

        // Force another refresh
        await refreshStrategies();
      }

      // 11. Resume strategy sync after a delay
      setTimeout(() => {
        console.log('Resuming strategy sync');
        strategySync.resumeSync();
      }, 2000); // Wait 2 seconds before resuming sync

      logService.log('info', `Strategy ${strategyId} deleted successfully`, null, 'StrategyManager');
      console.log(`Strategy ${strategyId} deletion process completed`);
    } catch (error) {
      console.error('Unexpected error in delete handler:', error);
      setError('Failed to delete strategy. Please try again.');

      // Even if there's an error, try to refresh the strategies list
      try {
        await refreshStrategies();
      } catch (refreshError) {
        console.error('Error refreshing strategies after deletion error:', refreshError);
      }
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
      setIsRefreshing(true);
      console.log(`StrategyManager: Creating strategy from template: ${template.id}`);

      // Create strategy from template
      const newStrategy = await templateGenerator.copyTemplateToStrategy(template.id);
      console.log(`StrategyManager: Strategy created from template: ${newStrategy.id}`);

      // Ensure the strategy has the correct market_type and selected_pairs
      if (newStrategy) {
        // Log the strategy data to verify fields
        console.log('StrategyManager: Template strategy data:', {
          id: newStrategy.id,
          market_type: newStrategy.market_type,
          marketType: newStrategy.marketType,
          selected_pairs: newStrategy.selected_pairs,
          pairs: newStrategy.selected_pairs ? newStrategy.selected_pairs.length : 0
        });

        // If market_type or selected_pairs are missing, update the strategy
        if (!newStrategy.market_type || !newStrategy.selected_pairs || newStrategy.selected_pairs.length === 0) {
          console.log('StrategyManager: Updating template strategy with missing fields');

          try {
            // Get template data to extract missing fields
            const { data: templateData } = await supabase
              .from('template_strategies')
              .select('*')
              .eq('id', template.id)
              .single();

            // Prepare update data
            const updateData: any = {};

            // Set market_type if missing
            if (!newStrategy.market_type) {
              updateData.market_type = templateData?.market_type || 'spot';
            }

            // Set marketType if missing (for UI components)
            if (!newStrategy.marketType) {
              updateData.marketType = templateData?.market_type || 'spot';
            }

            // Set selected_pairs if missing
            if (!newStrategy.selected_pairs || newStrategy.selected_pairs.length === 0) {
              // Try to get pairs from template or use defaults
              updateData.selected_pairs = templateData?.selected_pairs ||
                                         templateData?.strategy_config?.assets ||
                                         ['BTC_USDT'];
            }

            // Only update if we have fields to update
            if (Object.keys(updateData).length > 0) {
              console.log('StrategyManager: Updating strategy with fields:', updateData);

              // Update the strategy in the database
              const { data: updatedStrategy, error } = await supabase
                .from('strategies')
                .update(updateData)
                .eq('id', newStrategy.id)
                .select()
                .single();

              if (error) {
                console.error('StrategyManager: Error updating strategy:', error);
              } else if (updatedStrategy) {
                console.log('StrategyManager: Strategy updated successfully');
                // Use the updated strategy
                Object.assign(newStrategy, updatedStrategy);
              }
            }
          } catch (updateError) {
            console.error('StrategyManager: Error updating template strategy:', updateError);
          }
        }
      }

      // DIRECT APPROACH: Manually add the strategy to all lists
      console.log('StrategyManager: Manually adding strategy to all lists');

      // 1. Add to the main strategies array
      if (strategies) {
        console.log('StrategyManager: Current strategies count:', strategies.length);

        // Create a new array with the new strategy
        const updatedStrategiesArray = [...strategies, newStrategy];
        console.log('StrategyManager: Updated strategies count:', updatedStrategiesArray.length);

        // 2. Update filtered strategies
        setFilteredStrategies(prev => {
          // Only add if not already in the list
          if (!prev.some(s => s.id === newStrategy.id)) {
            console.log('StrategyManager: Adding strategy to filtered list');
            return [...prev, newStrategy];
          }
          console.log('StrategyManager: Strategy already in filtered list');
          return prev;
        });

        // 3. Update paginated strategies
        setPaginatedStrategies(prev => {
          // Only add if not already in the list
          if (!prev.some(s => s.id === newStrategy.id)) {
            console.log('StrategyManager: Adding strategy to paginated list');
            return [...prev, newStrategy];
          }
          console.log('StrategyManager: Strategy already in paginated list');
          return prev;
        });

        // 4. Force a re-render by updating the current page
        setCurrentPage(currentPage);
      } else {
        console.log('StrategyManager: No strategies array available');
      }

      // 5. Manually add the strategy to the strategy sync cache
      console.log('StrategyManager: Manually adding strategy to strategy sync cache');
      if (!strategySync.hasStrategy(newStrategy.id)) {
        strategySync.addStrategyToCache(newStrategy);
      }

      // 6. Manually emit events to update all components
      console.log('StrategyManager: Manually emitting events');
      eventBus.emit('strategy:created', newStrategy);
      eventBus.emit('strategy:created', { strategy: newStrategy }); // Also emit with object wrapper for compatibility

      document.dispatchEvent(new CustomEvent('strategy:created', {
        detail: { strategy: newStrategy }
      }));

      // 7. Force a complete refresh of strategies
      console.log('StrategyManager: Forcing complete refresh of strategies');
      try {
        await refreshStrategies();
        console.log('StrategyManager: Refresh completed');
      } catch (refreshError) {
        console.error('StrategyManager: Error refreshing strategies:', refreshError);
        // Continue even if refresh fails
      }

      // 8. Double-check that the strategy is in the lists
      setTimeout(async () => {
        console.log('StrategyManager: Performing delayed check');

        // Check if the strategy is in the filtered list
        const isInFiltered = filteredStrategies.some(s => s.id === newStrategy.id);
        if (!isInFiltered) {
          console.log(`StrategyManager: Strategy ${newStrategy.id} not in filtered list, adding it`);
          setFilteredStrategies(prev => [...prev, newStrategy]);
        } else {
          console.log(`StrategyManager: Strategy ${newStrategy.id} is in filtered list`);
        }

        // Check if the strategy is in the paginated list
        const isInPaginated = paginatedStrategies.some(s => s.id === newStrategy.id);
        if (!isInPaginated) {
          console.log(`StrategyManager: Strategy ${newStrategy.id} not in paginated list, adding it`);
          setPaginatedStrategies(prev => [...prev, newStrategy]);
        } else {
          console.log(`StrategyManager: Strategy ${newStrategy.id} is in paginated list`);
        }

        // Force another refresh
        try {
          await refreshStrategies();
          console.log('StrategyManager: Second refresh completed');
        } catch (refreshError) {
          console.error('StrategyManager: Error in second refresh:', refreshError);
          // Continue even if refresh fails
        }

        // Force a third refresh after a longer delay
        setTimeout(async () => {
          console.log('StrategyManager: Performing final delayed refresh');
          try {
            await refreshStrategies();
            console.log('StrategyManager: Final refresh completed');
          } catch (refreshError) {
            console.error('StrategyManager: Error in final refresh:', refreshError);
          }
        }, 2000);
      }, 1000);

      // Log success
      logService.log('info', `Strategy created from template ${template.id}`, { strategyId: newStrategy.id }, 'StrategyManager');
    } catch (err) {
      console.error('StrategyManager: Failed to create strategy from template:', err);
      logService.log('error', 'Failed to create strategy from template:', err, 'StrategyManager');
      setError('Failed to create strategy from template. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleActivateStrategy = async (strategy: Strategy) => {
    try {
      setError(null);
      setLoadingStrategy(strategy.id);

      // Check if budget is already set
      const budget = tradeService.getBudget(strategy.id);

      if (!budget) {
        // If no budget, show budget modal
        setSelectedStrategy(strategy);
        setShowBudgetModal(true);
        return;
      }

      // Check if budget exceeds available balance
      const availableBalance = walletBalanceService.getAvailableBalance();
      if (budget.total > availableBalance) {
        throw new Error(`Budget exceeds available balance of $${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
      }

      // If budget exists, proceed with full activation
      await activateStrategyWithBudget(strategy, budget);

      logService.log('info', `Strategy ${strategy.id} activated with existing budget`, { budget }, 'StrategyManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to activate strategy', error, 'StrategyManager');
    } finally {
      setLoadingStrategy(null);
    }
  };

  const activateStrategyWithBudget = async (strategy: Strategy, budget: any) => {
    let activationStage = 'initialization';
    let updatedStrategy = null;

    try {
      logService.log('info', `Starting strategy activation process for ${strategy.id}`,
        { strategyId: strategy.id, budget, isDemoMode: demoService.isInDemoMode() }, 'StrategyManager');

      // 0. Ensure the strategy exists in the strategy sync cache
      if (!strategySync.hasStrategy(strategy.id)) {
        strategySync.addStrategyToCache(strategy);
        logService.log('info', `Added strategy ${strategy.id} to strategy sync cache before activation`, null, 'StrategyManager');
      }

      // 1. Activate strategy in database
      activationStage = 'database_activation';
      try {
        updatedStrategy = await strategyService.activateStrategy(strategy.id);
        logService.log('info', `Strategy ${strategy.id} activated in database`, null, 'StrategyManager');
      } catch (activationError) {
        logService.log('error', `Failed to activate strategy ${strategy.id} in database`, activationError, 'StrategyManager');

        // If we're in demo mode, we can continue with a fallback
        if (demoService.isInDemoMode()) {
          logService.log('info', `Using fallback for demo mode activation of strategy ${strategy.id}`, null, 'StrategyManager');

          // Create an updated strategy object
          updatedStrategy = {
            ...strategy,
            status: 'active',
            updated_at: new Date().toISOString()
          };

          // Add to strategy sync cache
          strategySync.addStrategyToCache(updatedStrategy);
        } else {
          // In live mode, we need to fail
          throw new Error(`Failed to activate strategy in database: ${activationError instanceof Error ? activationError.message : 'Unknown error'}`);
        }
      }

      // 2. Start market monitoring
      activationStage = 'market_monitoring';
      try {
        await marketService.startStrategyMonitoring(updatedStrategy);
        logService.log('info', `Market monitoring started for strategy ${strategy.id}`, null, 'StrategyManager');
      } catch (marketError) {
        logService.log('warn', `Failed to start market monitoring for strategy ${strategy.id}, continuing activation`,
          marketError, 'StrategyManager');
        // Continue with activation despite this error
      }

      // 3. Add strategy to trade generator
      activationStage = 'trade_generator';
      try {
        await tradeGenerator.addStrategy(updatedStrategy);
        logService.log('info', `Strategy ${strategy.id} added to trade generator`, null, 'StrategyManager');
      } catch (generatorError) {
        logService.log('warn', `Failed to add strategy ${strategy.id} to trade generator, continuing activation`,
          generatorError, 'StrategyManager');
        // Continue with activation despite this error
      }

      // 4. Initialize strategy monitoring
      activationStage = 'strategy_monitoring';
      try {
        await strategyMonitor.addStrategy(updatedStrategy);
        logService.log('info', `Strategy monitoring initialized for strategy ${strategy.id}`, null, 'StrategyManager');
      } catch (monitorError) {
        logService.log('warn', `Failed to initialize strategy monitoring for ${strategy.id}, continuing activation`,
          monitorError, 'StrategyManager');
        // Continue with activation despite this error
      }

      // 5. Start trade engine monitoring
      activationStage = 'trade_engine';
      try {
        await tradeEngine.addStrategy(updatedStrategy);
        logService.log('info', `Trade engine monitoring started for strategy ${strategy.id}`, null, 'StrategyManager');
      } catch (engineError) {
        logService.log('warn', `Failed to start trade engine monitoring for ${strategy.id}, continuing activation`,
          engineError, 'StrategyManager');
        // Continue with activation despite this error
      }

      // 6. Connect to trading engine to start generating trades
      activationStage = 'trading_engine_connection';
      try {
        await tradeService.connectStrategyToTradingEngine(strategy.id);
        logService.log('info', `Strategy ${strategy.id} connected to trading engine`, null, 'StrategyManager');
      } catch (connectionError) {
        logService.log('warn', `Failed to connect strategy ${strategy.id} to trading engine, continuing activation`,
          connectionError, 'StrategyManager');
        // Continue with activation despite this error
      }

      // 7. Refresh data
      activationStage = 'data_refresh';
      await handleRefresh();

      // 8. Refresh wallet balances
      activationStage = 'wallet_refresh';
      try {
        await walletBalanceService.refreshBalances();
      } catch (walletError) {
        logService.log('warn', `Failed to refresh wallet balances, continuing activation`,
          walletError, 'StrategyManager');
        // Continue with activation despite this error
      }

      logService.log('info', `Strategy ${strategy.id} activated with budget successfully`,
        { strategy, budget }, 'StrategyManager');

    } catch (error) {
      logService.log('error', `Strategy activation failed at stage: ${activationStage}`,
        { strategyId: strategy.id, error }, 'StrategyManager');

      // If we've already activated the strategy in the database but a later step failed,
      // try to deactivate it to maintain consistency
      if (activationStage !== 'initialization' && activationStage !== 'database_activation' && updatedStrategy) {
        try {
          logService.log('info', `Attempting to deactivate strategy ${strategy.id} after activation failure`,
            null, 'StrategyManager');
          await strategyService.deactivateStrategy(strategy.id);
          logService.log('info', `Successfully deactivated strategy ${strategy.id} after activation failure`,
            null, 'StrategyManager');
        } catch (deactivationError) {
          logService.log('error', `Failed to deactivate strategy ${strategy.id} after activation failure`,
            deactivationError, 'StrategyManager');
        }
      }

      throw error;
    }
  };

  const handleDeactivateStrategy = async (strategy: Strategy) => {
    try {
      setError(null);

      // 1. Get active trades for this strategy
      const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
      logService.log('info', `Found ${activeTrades.length} active trades to close for strategy ${strategy.id}`, null, 'StrategyManager');

      // 2. Close any active trades
      if (activeTrades.length > 0) {
        try {
          // Close each active trade
          for (const trade of activeTrades) {
            try {
              // Close the trade and release the budget
              await tradeEngine.closeTrade(trade.id, 'Strategy deactivated');
              logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id}`, null, 'StrategyManager');
            } catch (tradeError) {
              logService.log('warn', `Failed to close trade ${trade.id}, continuing with deactivation`, tradeError, 'StrategyManager');
            }
          }
        } catch (tradesError) {
          logService.log('warn', 'Error closing trades, continuing with deactivation', tradesError, 'StrategyManager');
        }
      }

      // 3. Deactivate strategy in database
      await strategyService.deactivateStrategy(strategy.id);

      // 4. Remove from monitoring services
      try {
        await marketService.stopStrategyMonitoring(strategy.id);
      } catch (marketError) {
        logService.log('warn', 'Error stopping market monitoring, continuing with deactivation', marketError, 'StrategyManager');
      }

      try {
        tradeGenerator.removeStrategy(strategy.id);
      } catch (generatorError) {
        logService.log('warn', 'Error removing from trade generator, continuing with deactivation', generatorError, 'StrategyManager');
      }

      try {
        strategyMonitor.removeStrategy(strategy.id);
      } catch (monitorError) {
        logService.log('warn', 'Error removing from strategy monitor, continuing with deactivation', monitorError, 'StrategyManager');
      }

      try {
        await tradeEngine.removeStrategy(strategy.id);
      } catch (engineError) {
        logService.log('warn', 'Error removing from trade engine, continuing with deactivation', engineError, 'StrategyManager');
      }

      // 5. Refresh data
      await handleRefresh();

      // 6. Refresh wallet balances
      await walletBalanceService.refreshBalances();

      logService.log('info', `Strategy ${strategy.id} deactivated successfully`, null, 'StrategyManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to deactivate strategy', error, 'StrategyManager');
    }
  };

  const handleBudgetSubmit = async (budget: StrategyBudget) => {
    if (!selectedStrategy) return;

    try {
      setIsSubmittingBudget(true);
      setError(null);

      // Check if budget exceeds available balance
      const availableBalance = walletBalanceService.getAvailableBalance();
      if (budget.total > availableBalance) {
        throw new Error(`Budget exceeds available balance of $${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
      }

      // 1. First, ensure the budget is set and confirmed
      try {
        // Set budget for the strategy
        await tradeService.setBudget(selectedStrategy.id, budget);
        logService.log('info', `Budget set for strategy ${selectedStrategy.id}`, { budget }, 'StrategyManager');
      } catch (budgetError) {
        logService.log('error', 'Failed to set budget', budgetError, 'StrategyManager');
        throw new Error('Failed to set budget. Please try again.');
      }

      // 2. Verify the budget was set correctly
      const confirmedBudget = tradeService.getBudget(selectedStrategy.id);
      if (!confirmedBudget) {
        throw new Error('Budget could not be confirmed. Please try again.');
      }

      // 3. Proceed with full activation
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
        try {
          await tradeService.setBudget(selectedStrategy.id, null);
        } catch (cleanupError) {
          logService.log('error', 'Failed to clean up budget after activation failure',
            cleanupError, 'StrategyManager');
        }
      }
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  // Effects for strategy creation and updates
  useEffect(() => {
    if (!user) return;

    // Handle strategy creation events from event bus
    const unsubscribeCreated = eventBus.subscribe('strategy:created', async (data) => {
      console.log('Strategy created event received:', data);
      await handleRefresh();
    });

    // Handle strategy activation events from event bus
    const unsubscribeActivated = eventBus.subscribe('strategy:activated', async (data) => {
      console.log('Strategy activated event received:', data);
      await handleRefresh();
    });

    // Handle DOM events for legacy components
    const handleDomStrategyCreated = async (event: Event) => {
      console.log('DOM strategy created event received:', (event as CustomEvent).detail);
      await handleRefresh();
    };

    document.addEventListener('strategy:created', handleDomStrategyCreated as EventListener);

    // Handle database changes via Supabase realtime
    const subscription = supabase
      .channel('strategy_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'strategies'
      }, async (payload) => {
        console.log('Supabase strategy change received:', payload);
        await handleRefresh();
      })
      .subscribe();

    return () => {
      unsubscribeCreated();
      unsubscribeActivated();
      document.removeEventListener('strategy:created', handleDomStrategyCreated as EventListener);
      subscription.unsubscribe();
    };
  }, [handleRefresh, user]);

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
      <div className="min-h-screen bg-gunmetal-950 relative">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="gradient-text mb-2">Strategy Manager</h1>
            <CollapsibleDescription id="strategy-manager-description" className="mb-4">
              <p className="description-text">Create, manage, and monitor your trading strategies. Activate strategies to generate real-time trades based on market conditions.</p>
            </CollapsibleDescription>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neon-orange text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 btn-text-small font-bold"
              >
                <Plus className="w-4 h-4" />
                Create Strategy
              </button>
            </div>
          </div>

          {/* Stats */}
          <StrategyStats strategies={strategies} className="mb-8" />

          {/* Filters Section */}
          {/* Main search and filter section removed - now each panel has its own search */}

          {/* Asset Display Panel */}
          <AssetDisplayPanel className="mb-4" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6">
            {/* Your Strategies Section */}
            <div className="w-full panel-metallic rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold gradient-text">Your Strategies</h2>
                <span className="text-sm text-gray-400">{filteredStrategies.length} strategies</span>
              </div>

              {/* Strategy Search Filter */}
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search your strategies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-gunmetal-800/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-turquoise text-sm"
                  />
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-turquoise"></div>
                </div>
              ) : strategiesError ? (
                <div className="bg-gunmetal-900 rounded-xl p-6 text-center shadow-inner">
                  <AlertCircle className="w-12 h-12 text-neon-raspberry mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">Error loading strategies</p>
                  <p className="text-gray-400 text-sm mb-4">Please try refreshing the page</p>
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-all"
                  >
                    Retry
                  </button>
                </div>
              ) : (filteredStrategies?.length || 0) === 0 ? (
                <div className="bg-gunmetal-900 rounded-xl p-6 text-center shadow-inner">
                  <Brain className="w-12 h-12 text-neon-turquoise mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No strategies found</p>
                  <p className="text-gray-400 text-sm mb-4">{searchTerm ? "Try adjusting your search" : "Create your first strategy"}</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-neon-orange text-white rounded-lg hover:bg-opacity-90 transition-all font-bold"
                  >
                    Create Strategy
                  </button>
                </div>
              ) : (
                <>
                  {screenSize === 'sm' ? (
                    <div className="grid grid-cols-1 gap-3 mb-3 relative pt-8 pb-4">
                      {/* Metallic pagination with tabs */}
                      <MetallicPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />

                      {(paginatedStrategies || []).map((strategy) => (
                        <motion.div
                          key={strategy.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="strategy-card rounded-xl"
                        >
                          <StrategyCard
                            key={strategy.id}
                            strategy={strategy}
                            isExpanded={false}
                            onToggleExpand={() => {}}
                            onRefresh={refreshStrategies}
                            onEdit={handleEditStrategy}
                            onDelete={handleDeleteStrategy}
                            hideExpandArrow={true}
                            // Deliberately not passing onActivate and onDeactivate to hide those buttons
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 mb-3 relative pt-8 pb-4">
                      {/* Metallic pagination with tabs */}
                      <MetallicPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />

                      {(paginatedStrategies || []).map((strategy) => (
                        <motion.div
                          key={strategy.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="strategy-card rounded-xl"
                        >
                          <StrategyCard
                            key={strategy.id}
                            strategy={strategy}
                            isExpanded={false}
                            onToggleExpand={() => {}}
                            onRefresh={refreshStrategies}
                            onEdit={handleEditStrategy}
                            onDelete={handleDeleteStrategy}
                            hideExpandArrow={true} // Hide the expand arrow in Your Strategies section
                            // Deliberately not passing onActivate and onDeactivate to hide those buttons
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Pagination is now handled by MetallicPagination */}
                </>
              )}
            </div>

            {/* Template Strategies Section */}
            <div className="w-full panel-metallic rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry">Template Strategies</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{filteredTemplates.length} templates available</span>
                </div>
              </div>

              {/* Template Search Filter */}
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-gunmetal-800/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-turquoise text-sm"
                  />
                </div>
              </div>

              {loadingTemplates ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-turquoise"></div>
                </div>
              ) : templateError ? (
                <div className="bg-gunmetal-900 rounded-xl p-6 text-center shadow-inner">
                  <AlertCircle className="w-12 h-12 text-neon-raspberry mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">Failed to load templates</p>
                  <p className="text-gray-400 text-sm mb-4">{templateError}</p>
                  <button
                    onClick={loadTemplates}
                    className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="bg-gunmetal-900 rounded-xl p-6 text-center shadow-inner">
                  <Brain className="w-12 h-12 text-neon-turquoise mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No templates available</p>
                  <p className="text-gray-400 text-sm">Check back later for new templates</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 mb-3 relative pt-8 pb-4">
                    {/* Metallic pagination with tabs */}
                    <MetallicPagination
                      currentPage={templatePage + 1}
                      totalPages={totalTemplatePages}
                      onPageChange={(page) => setTemplatePage(page - 1)}
                    />

                    {paginatedTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="panel-metallic rounded-xl p-6 flex flex-col h-full"
                      >
                        {screenSize === 'sm' ? (
                          <SwipeAnimation>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <Monitor className="w-5 h-5 text-neon-turquoise" />
                                  <h3 className="text-lg font-semibold text-neon-turquoise">{template.title}</h3>
                                  <div className="px-2 py-1 bg-gunmetal-900 rounded-lg text-xs font-medium text-gray-400">
                                    {template.riskLevel} Risk
                                  </div>
                                </div>

                                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{template.description}</p>

                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-400">Win Rate: </span>
                                  <span className="text-sm text-neon-turquoise">
                                    {template.metrics?.winRate
                                      ? `${Number(template.metrics.winRate).toFixed(1)}%`
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>

                              <div className="ml-4 flex-shrink-0 self-center">
                                <button
                                  onClick={() => handleUseTemplate(template)}
                                  className="px-3 py-2 border rounded-lg text-sm transition-all flex items-center justify-center gap-1 bg-transparent border-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry bg-clip-text text-transparent hover:opacity-80"
                                  style={{ borderImage: 'linear-gradient(to right, #00ffd1, #fff152, #ff3864) 1' }}
                                >
                                  <Plus className="w-4 h-4 text-neon-turquoise" />
                                  Add +
                                </button>
                              </div>
                            </div>
                          </SwipeAnimation>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <Monitor className="w-5 h-5 text-neon-turquoise" />
                                  <h3 className="text-lg font-semibold text-neon-turquoise">{template.title}</h3>
                                  <div className="px-2 py-1 bg-gunmetal-900 rounded-lg text-xs font-medium text-gray-400">
                                    {template.riskLevel} Risk
                                  </div>
                                </div>

                                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{template.description}</p>

                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-400">Win Rate: </span>
                                  <span className="text-sm text-neon-turquoise">
                                    {template.metrics?.winRate
                                      ? `${Number(template.metrics.winRate).toFixed(1)}%`
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>

                              <div className="ml-4 flex-shrink-0 self-center">
                                <button
                                  onClick={() => handleUseTemplate(template)}
                                  className="px-3 py-2 border rounded-lg text-sm transition-all flex items-center justify-center gap-1 bg-transparent border-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry bg-clip-text text-transparent hover:opacity-80"
                                  style={{ borderImage: 'linear-gradient(to right, #00ffd1, #fff152, #ff3864) 1' }}
                                >
                                  <Plus className="w-4 h-4 text-neon-turquoise" />
                                  Add +
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
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
