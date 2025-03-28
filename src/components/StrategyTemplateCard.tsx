import { motion } from 'framer-motion';
import { Brain, Check, Loader2 } from 'lucide-react';
import { RiskLevelBadge } from './risk/RiskLevelBadge';
import type { StrategyTemplate } from '../lib/types';

interface StrategyTemplateCardProps {
  template: StrategyTemplate;
  onUse: (template: StrategyTemplate) => void;
  isCreating: boolean;
}

export function StrategyTemplateCard({ template, onUse, isCreating }: StrategyTemplateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700 min-h-[320px] flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-turquoise">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-200">{template.title}</h3>
          <RiskLevelBadge 
            level={template.risk_level.toLowerCase() as 'low' | 'medium' | 'high'} 
            size="sm" 
          />
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4 flex-grow">{template.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Win Rate</p>
          <p className="text-sm font-semibold text-neon-turquoise">
            {template.metrics.winRate}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Avg Return</p>
          <p className="text-sm font-semibold text-neon-turquoise">
            {template.metrics.avgReturn}%
          </p>
        </div>
      </div>

      <button
        onClick={() => onUse(template)}
        disabled={isCreating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all disabled:opacity-50"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Use Template
          </>
        )}
      </button>
    </motion.div>
  );
}