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
  SortDesc
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { templateService } from '../lib/template-service';
import { logService } from '../lib/log-service';
import type { StrategyTemplate } from '../lib/types';

interface StrategyTemplatesProps {
  onStrategyCreated?: () => void;
  className?: string;
}

export function StrategyTemplates({ onStrategyCreated, className = "" }: StrategyTemplatesProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingStrategy, setCreatingStrategy] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'winRate' | 'avgReturn'>('winRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('User not authenticated');
      }

      const userTemplates = await templateService.getTemplatesForUser(user.id);
      setTemplates(userTemplates);
    } catch (err) {
      setError('Failed to load strategy templates');
      logService.log('error', 'Failed to load templates:', err, 'StrategyTemplates');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (template: StrategyTemplate) => {
    if (!user) return;

    try {
      setCreatingStrategy(template.id);
      setError(null);

      // Create strategy from template
      await templateService.createStrategyFromTemplate(template.id);
      onStrategyCreated?.();

      logService.log('info', `Created strategy from template ${template.id}`, null, 'StrategyTemplates');
    } catch (err) {
      setError('Failed to create strategy from template');
      logService.log('error', 'Error creating strategy from template:', err, 'StrategyTemplates');
    } finally {
      setCreatingStrategy(null);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = !riskFilter || template.risk_level === riskFilter;
    return matchesSearch && matchesRisk;
  }).sort((a, b) => {
    const field = sortField === 'winRate' ? 'winRate' : 'avgReturn';
    const comparison = (a.metrics[field] || 0) - (b.metrics[field] || 0);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }

  return (
    <div className={className}>
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
            value={riskFilter || ''}
            onChange={(e) => setRiskFilter(e.target.value || null)}
            className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          >
            <option value="">All Risk Levels</option>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => (
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
                <span className="text-sm text-neon-raspberry">AI Generated</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">{template.description}</p>
            
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm">
                <span className="text-gray-400">Performance: </span>
                <span className="text-neon-turquoise">{template.performance}%</span>
              </div>
              <button
                onClick={() => handleUseTemplate(template)}
                disabled={creatingStrategy === index}
                className="flex items-center gap-2 px-4 py-2 bg-gunmetal-900 text-gray-200 rounded-lg hover:text-neon-turquoise transition-all duration-300"
              >
                {creatingStrategy === index ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Use Template
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
    </div>
  );
}
