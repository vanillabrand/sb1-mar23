import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { strategyService } from '../lib/strategy-service';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/types';

interface EditStrategyModalProps {
  strategy: Strategy;
  onClose: () => void;
  onSave: (updatedStrategy: Strategy) => void;
}

export function EditStrategyModal({ strategy, onClose, onSave }: EditStrategyModalProps) {
  const [title, setTitle] = useState(strategy.title || '');
  const [description, setDescription] = useState(strategy.description || '');
  const [riskLevel, setRiskLevel] = useState(strategy.riskLevel || 'Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      if (!title.trim()) {
        throw new Error('Strategy title is required');
      }

      // Properly capitalize the strategy title
      // This will capitalize the first letter of each word
      const capitalizedTitle = title
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const updatedStrategy = {
        ...strategy,
        title: capitalizedTitle,
        description,
        riskLevel,
        updated_at: new Date().toISOString()
      };

      // Update strategy in database
      const result = await strategyService.updateStrategy(strategy.id, updatedStrategy);

      logService.log('info', `Strategy ${strategy.id} updated successfully`, null, 'EditStrategyModal');

      // Notify parent component
      onSave(result);
      onClose();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to update strategy', error, 'EditStrategyModal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-lg p-6 w-full max-w-md border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">Edit Strategy</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gunmetal-800 text-gray-400 hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Strategy Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              placeholder="Enter strategy name"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              placeholder="Describe your strategy"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Risk Level
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="Ultra Low">Ultra Low</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Ultra High">Ultra High</option>
              <option value="Extreme">Extreme</option>
              <option value="God Mode">God Mode</option>
            </select>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
