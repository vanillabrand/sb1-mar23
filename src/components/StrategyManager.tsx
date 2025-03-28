import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain,
  Plus,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Edit2,
  Trash2,
  Power,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Tag
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { logService } from '../lib/log-service';
import { aiService } from '../lib/ai-service';
import { StrategyLibrary } from './StrategyLibrary';
import { BudgetModal } from './BudgetModal';
import { tradeService } from '../lib/trade-service';
import { BacktestOffer } from './BacktestOffer';
import { StrategyEditor } from './StrategyEditor';
import { marketService } from '../lib/market-service';
import { PanelWrapper } from './PanelWrapper';
import { tradeManager } from '../lib/trade-manager';
import { CreateStrategyModal } from './CreateStrategyModal';
import { DeleteConfirmation } from './DeleteConfirmation';
import { Combobox } from './ui/Combobox';
import { supabase } from '../lib/supabase';
import type { Strategy, StrategyBudget } from '../lib/types';

export function StrategyManager() {
  const { strategies, loading: strategiesLoading, error: strategiesError, refresh } = useStrategies();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  return (
    <div className="space-y-6">
      <PanelWrapper title="Strategy Manager" icon={<Brain className="w-5 h-5" />}>
        <div className="space-y-8">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold gradient-text">Trading Strategies</h2>
            <button
              data-testid="new-strategy-btn"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Strategy
            </button>
          </div>

          {/* Strategy List */}
          <div className="bg-gunmetal-900/50 rounded-xl p-6">
            {strategiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-neon-turquoise" />
              </div>
            ) : strategiesError ? (
              <div className="text-red-400 text-center py-4">
                Failed to load strategies
              </div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No strategies created yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {strategies.map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onSelect={() => setSelectedStrategy(strategy)}
                    onBudgetClick={() => {
                      setSelectedStrategy(strategy);
                      setShowBudgetModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Strategy Library Section */}
          <div className="bg-gunmetal-900/50 rounded-xl p-6">
            <h2 className="text-xl font-bold gradient-text mb-6">Strategy Library</h2>
            <StrategyLibrary onStrategyCreated={refresh} />
          </div>
        </div>
      </PanelWrapper>

      {/* Modals */}
      <CreateStrategyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refresh}
      />
      
      <BudgetModal
        open={showBudgetModal}
        strategy={selectedStrategy}
        onClose={() => {
          setShowBudgetModal(false);
          setSelectedStrategy(null);
        }}
      />
    </div>
  );
}

function StrategyCard({ strategy, onSelect, onBudgetClick }) {
  return (
    <div className="bg-gunmetal-800 rounded-lg p-4 hover:bg-gunmetal-700 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-neon-turquoise">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-200">{strategy.title}</h3>
            <p className="text-sm text-gray-400">{strategy.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBudgetClick()}
            className="p-2 text-neon-turquoise hover:bg-gunmetal-900 rounded-lg transition-all"
          >
            <Wallet className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelect()}
            className="p-2 text-neon-yellow hover:bg-gunmetal-900 rounded-lg transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
