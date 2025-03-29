import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { FilterOptions, SortOption } from '../lib/types';

interface StrategyFiltersProps {
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
  onSort: (sort: SortOption) => void;
  currentSort: SortOption;
}

export function StrategyFilters({ 
  options, 
  onChange, 
  onSort, 
  currentSort 
}: StrategyFiltersProps) {
  return (
    <div className="flex gap-3">
      <select
        value={options.status}
        onChange={(e) => onChange({ ...options, status: e.target.value })}
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-xl px-4 py-2 text-gray-200 focus:outline-none focus:border-neon-raspberry"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="error">Error</option>
      </select>

      <select
        value={options.riskLevel}
        onChange={(e) => onChange({ ...options, riskLevel: e.target.value })}
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-xl px-4 py-2 text-gray-200 focus:outline-none focus:border-neon-raspberry"
      >
        <option value="all">All Risk Levels</option>
        <option value="low">Low Risk</option>
        <option value="medium">Medium Risk</option>
        <option value="high">High Risk</option>
      </select>

      <button
        onClick={() => onSort(currentSort === 'performance' ? '-performance' : 'performance')}
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-xl px-4 py-2 text-gray-200 hover:border-neon-raspberry flex items-center gap-2"
      >
        {currentSort === 'performance' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
        Performance
      </button>
    </div>
  );
}
