import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Plus,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Copy,
  Target,
  Shield,
  Gauge,
  Crown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { templateService } from '../lib/template-service';
import { logService } from '../lib/log-service';
import { BudgetModal } from './BudgetModal';
import { tradeService } from '../lib/trade-service';
import { strategyService } from '../lib/strategy-service';
import { strategySync } from '../lib/strategy-sync';
import { marketService } from '../lib/market-service';
import { tradeManager } from '../lib/trade-manager';
import { eventBus } from '../lib/event-bus';
import type { StrategyTemplate, RiskLevel, StrategyBudget } from '../lib/types';
import { useScreenSize } from '../lib/hooks/useScreenSize';

interface StrategyLibraryProps {
  onStrategyCreated?: () => void;
  className?: string;
}

export function StrategyLibrary({ onStrategyCreated, className = "" }: StrategyLibraryProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [sortField, setSortField] = useState<'winRate' | 'avgReturn'>('winRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<StrategyTemplate | null>(null);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const screenSize = useScreenSize();

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const userTemplates = await templateService.getTemplatesForUser();
      setTemplates(userTemplates);
    } catch (err) {
      setError('Failed to load strategy templates');
      logService.log('error', 'Failed to load templates:', err, 'StrategyLibrary');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = async (template: StrategyTemplate, event?: React.MouseEvent) => {
    // Prevent event propagation to avoid interfering with navigation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!user) {
      setError('Please sign in to create a strategy');
      return;
    }

    try {
      // Show the budget modal instead of creating the strategy directly
      setPendingTemplate(template);
      setShowBudgetModal(true);

      logService.log('info', 'Showing budget modal for template', { templateId: template.id }, 'StrategyLibrary');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare strategy creation';
      setError(errorMessage);
      logService.log('error', 'Failed to prepare strategy creation', err, 'StrategyLibrary');
    }
  };

  const handleSubmitBudget = async (budget: number) => {
    if (!pendingTemplate) return;

    try {
      setIsSubmittingBudget(true);
      setError(null);

      // Create strategy from template
      const strategy = await templateService.createStrategyFromTemplate(pendingTemplate.id);

      if (!strategy) {
        throw new Error('Failed to create strategy from template');
      }

      // Create a proper budget object
      const budgetObj = {
        total: budget,
        allocated: 0,
        available: budget,
        maxPositionSize: budget * 0.2 // 20% of total budget as max position size
      };

      // Set budget
      await tradeService.setBudget(strategy.id, budgetObj);

      // Activate the strategy
      const activatedStrategy = await strategyService.activateStrategy(strategy.id);

      // Force refresh all views that display strategies
      await Promise.all([
        strategySync.initialize(), // Refresh strategy sync
        marketService.syncStrategies(), // Refresh market data
        tradeManager.syncTrades() // Refresh trades
      ]);

      // Get the latest strategies after initialization
      const updatedStrategies = strategySync.getAllStrategies();

      // Emit events for real-time updates
      eventBus.emit('strategy:activated', activatedStrategy);
      eventBus.emit('strategy:created', activatedStrategy);
      eventBus.emit('strategies:updated', updatedStrategies);

      // Dispatch DOM events for legacy components
      document.dispatchEvent(new CustomEvent('strategy:created', {
        detail: { strategy: activatedStrategy }
      }));

      document.dispatchEvent(new CustomEvent('strategies:updated', {
        detail: { strategies: updatedStrategies }
      }));

      // Close modals and refresh
      setShowBudgetModal(false);
      setPendingTemplate(null);

      // Notify parent component
      if (onStrategyCreated) {
        onStrategyCreated();
      }

      logService.log('info', 'Strategy created from template with budget and activated', { strategy: activatedStrategy, budget }, 'StrategyLibrary');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create strategy with budget';
      setError(errorMessage);
      logService.log('error', 'Failed to create strategy with budget', err, 'StrategyLibrary');
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'all' || template.risk_level === riskFilter;
    return matchesSearch && matchesRisk;
  }).sort((a, b) => {
    const field = sortField === 'winRate' ? 'winRate' : 'avgReturn';
    const comparison = (a.metrics[field] || 0) - (b.metrics[field] || 0);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Limit number of displayed templates based on screen size
  const displayLimit = screenSize === 'sm' ? 3 : 6;
  const displayedTemplates = filteredTemplates.slice(0, 10);

  const getRiskIcon = (risk: RiskLevel) => {
    switch (risk) {
      case 'Ultra Low': return Shield;
      case 'Low': return Shield;
      case 'Medium': return Target;
      case 'High': return Gauge;
      case 'Ultra High': return Crown;
      case 'Extreme': return Crown;
      case 'God Mode': return Crown;
      default: return Target;
    }
  };

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'Ultra Low': return 'text-emerald-400';
      case 'Low': return 'text-neon-turquoise';
      case 'Medium': return 'text-neon-yellow';
      case 'High': return 'text-neon-orange';
      case 'Ultra High': return 'text-neon-pink';
      case 'Extreme': return 'text-purple-400';
      case 'God Mode': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={className}>
      {/* Library Description */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold gradient-text mb-2">Strategy Library</h3>
        <p className="text-sm text-gray-400">
          Choose from our collection of pre-built trading strategies. Each template is designed and optimized for different market conditions and risk levels.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskLevel | 'all')}
            className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          >
            <option value="all">All Risk Levels</option>
            <option value="Ultra Low">Ultra Low</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Ultra High">Ultra High</option>
            <option value="Extreme">Extreme</option>
            <option value="God Mode">God Mode</option>
          </select>

          <button
            onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="w-5 h-5" />
            ) : (
              <SortDesc className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
          </div>
        ) : error ? (
          <div className="col-span-full bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-neon-pink" />
            <p className="text-neon-pink">{error}</p>
          </div>
        ) : displayedTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
            <p className="text-xl text-gray-200 mb-2">No Templates Found</p>
            <p className="text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          displayedTemplates.map((template) => {
            const RiskIcon = getRiskIcon(template.risk_level);
            const riskColor = getRiskColor(template.risk_level);

            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700 min-h-[320px] flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg bg-gunmetal-900/50 ${riskColor}`}>
                    <RiskIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-200">{template.title}</h3>
                    <span className={`text-sm ${riskColor}`}>{template.risk_level}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4 flex-grow">{template.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-400">Win Rate</p>
                    <p className="text-lg font-medium text-neon-turquoise">
                      {Number(template.metrics.winRate).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-400">Expected Return</p>
                    <p className="text-lg font-medium text-neon-yellow">
                      {Number(template.metrics.avgReturn).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleCreateFromTemplate(template, e)}
                  disabled={isCreating}
                  className="w-32 flex items-center justify-center gap-2 px-4 py-2 bg-gunmetal-900 text-gray-200 rounded-lg hover:text-neon-turquoise transition-all duration-300 disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      +Copy
                    </>
                  )}
                </button>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Budget Modal */}
      {showBudgetModal && pendingTemplate && (
        <BudgetModal
          onConfirm={handleSubmitBudget}
          onCancel={() => {
            setShowBudgetModal(false);
            setPendingTemplate(null);
          }}
          maxBudget={tradeService.calculateAvailableBudget()}
          riskLevel={pendingTemplate.risk_level}
          isSubmitting={isSubmittingBudget}
        />
      )}
    </div>
  );
}
