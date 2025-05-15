import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Brain, 
  Plus, 
  AlertCircle, 
  Loader2, 
  Search,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { Strategy } from '../../lib/types';
import { SimplifiedStrategyCard } from './SimplifiedStrategyCard';
import { SimplifiedStrategyWizard } from './SimplifiedStrategyWizard';
import { SimplifiedStrategyDetails } from './SimplifiedStrategyDetails';

export function SimplifiedStrategyManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  
  // Get action and id from URL params
  const action = searchParams.get('action');
  const strategyId = searchParams.get('id');
  
  // Load strategies on component mount
  useEffect(() => {
    loadStrategies();
    
    // Listen for strategy updates
    document.addEventListener('strategies:updated', handleStrategiesUpdated);
    
    return () => {
      document.removeEventListener('strategies:updated', handleStrategiesUpdated);
    };
  }, []);
  
  // Handle URL params
  useEffect(() => {
    if (action === 'create') {
      setShowCreateWizard(true);
    } else if (strategyId) {
      const strategy = strategies.find(s => s.id === strategyId);
      if (strategy) {
        setSelectedStrategy(strategy);
      }
    }
  }, [action, strategyId, strategies]);
  
  // Apply filters when strategies or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [strategies, searchTerm, statusFilter]);
  
  // Handle strategies updated event
  const handleStrategiesUpdated = () => {
    loadStrategies();
  };
  
  // Load strategies
  const loadStrategies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allStrategies = strategySync.getAllStrategies();
      setStrategies(allStrategies);
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load strategies');
      setLoading(false);
      logService.log('error', 'Failed to load strategies', err, 'SimplifiedStrategyManager');
    }
  };
  
  // Apply filters to strategies
  const applyFilters = () => {
    let filtered = [...strategies];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(strategy => 
        strategy.name.toLowerCase().includes(term) || 
        (strategy.description && strategy.description.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(strategy => strategy.status === statusFilter);
    }
    
    setFilteredStrategies(filtered);
  };
  
  // Handle strategy creation
  const handleStrategyCreated = () => {
    setShowCreateWizard(false);
    loadStrategies();
    // Clear URL params
    setSearchParams({});
  };
  
  // Handle view strategy details
  const handleViewStrategyDetails = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setSearchParams({ id: strategy.id });
  };
  
  // Handle back to list
  const handleBackToList = () => {
    setSelectedStrategy(null);
    setSearchParams({});
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }
  
  // Render strategy details view
  if (selectedStrategy) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 mb-4 text-gray-400 hover:text-neon-turquoise transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Strategies
        </button>
        
        <SimplifiedStrategyDetails 
          strategy={selectedStrategy} 
          onRefresh={loadStrategies}
        />
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Strategy Manager</h1>
          <p className="text-gray-400">Create and manage your trading strategies</p>
        </div>
        
        <button
          onClick={() => setShowCreateWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          New Strategy
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search strategies..."
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      
      {/* Strategies List */}
      {filteredStrategies.length === 0 ? (
        <div className="bg-gunmetal-800/50 rounded-lg p-8 text-center">
          <Brain className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Strategies Found</h3>
          <p className="text-gray-400 mb-4">
            {strategies.length === 0 
              ? "You haven't created any strategies yet" 
              : "No strategies match your filters"}
          </p>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            Create Strategy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredStrategies.map(strategy => (
            <SimplifiedStrategyCard 
              key={strategy.id} 
              strategy={strategy} 
              onViewDetails={() => handleViewStrategyDetails(strategy)}
              onRefresh={loadStrategies}
            />
          ))}
        </div>
      )}
      
      {/* Create Strategy Wizard */}
      {showCreateWizard && (
        <SimplifiedStrategyWizard
          onComplete={handleStrategyCreated}
          onCancel={() => {
            setShowCreateWizard(false);
            setSearchParams({});
          }}
        />
      )}
    </motion.div>
  );
}
