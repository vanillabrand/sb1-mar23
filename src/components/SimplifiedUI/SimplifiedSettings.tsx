import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Building2,
  AlertCircle,
  Loader2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Key,
  Shield
} from 'lucide-react';
import { demoService } from '../../lib/demo-service';
import { exchangeService } from '../../lib/exchange-service';
import { logService } from '../../lib/log-service';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export function SimplifiedSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [activeExchange, setActiveExchange] = useState<any | null>(null);
  const [showAddExchangeForm, setShowAddExchangeForm] = useState(false);

  // New exchange form state
  const [newExchangeName, setNewExchangeName] = useState('binance');
  const [newExchangeApiKey, setNewExchangeApiKey] = useState('');
  const [newExchangeApiSecret, setNewExchangeApiSecret] = useState('');
  const [isSubmittingExchange, setIsSubmittingExchange] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadSettings();

    // Listen for demo mode changes
    document.addEventListener('demo:changed', handleDemoModeChanged);

    return () => {
      document.removeEventListener('demo:changed', handleDemoModeChanged);
    };
  }, []);

  // Handle demo mode changed event
  const handleDemoModeChanged = () => {
    setIsDemoMode(demoService.isDemoMode());
  };

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load exchanges
      await loadExchanges();

      setLoading(false);
    } catch (err) {
      setError('Failed to load settings');
      setLoading(false);
      logService.log('error', 'Failed to load settings', err, 'SimplifiedSettings');
    }
  };

  // Load exchanges
  const loadExchanges = async () => {
    try {
      // Get user exchanges
      const { data, error } = await supabase
        .from('exchanges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExchanges(data || []);

      // Get active exchange
      const active = await exchangeService.getActiveExchange();
      setActiveExchange(active);
    } catch (err) {
      logService.log('error', 'Failed to load exchanges', err, 'SimplifiedSettings');
    }
  };

  // Toggle demo mode
  const handleToggleDemoMode = () => {
    try {
      const newMode = !isDemoMode;
      demoService.setDemoMode(newMode);
      setIsDemoMode(newMode);

      setSuccess(`Switched to ${newMode ? 'Demo' : 'Live'} mode`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to toggle demo mode');
      logService.log('error', 'Failed to toggle demo mode', err, 'SimplifiedSettings');
    }
  };

  // Set active exchange
  const handleSetActiveExchange = async (exchangeId: string) => {
    try {
      setLoading(true);

      // Set active exchange
      await exchangeService.setActiveExchange(exchangeId);

      // Reload exchanges
      await loadExchanges();

      setSuccess('Exchange activated successfully');
      setTimeout(() => setSuccess(null), 3000);

      setLoading(false);
    } catch (err) {
      setError('Failed to set active exchange');
      setLoading(false);
      logService.log('error', 'Failed to set active exchange', err, 'SimplifiedSettings');
    }
  };

  // Remove exchange
  const handleRemoveExchange = async (exchangeId: string) => {
    try {
      setLoading(true);

      // Remove exchange
      const { error } = await supabase
        .from('exchanges')
        .delete()
        .eq('id', exchangeId);

      if (error) throw error;

      // Reload exchanges
      await loadExchanges();

      setSuccess('Exchange removed successfully');
      setTimeout(() => setSuccess(null), 3000);

      setLoading(false);
    } catch (err) {
      setError('Failed to remove exchange');
      setLoading(false);
      logService.log('error', 'Failed to remove exchange', err, 'SimplifiedSettings');
    }
  };

  // Add new exchange
  const handleAddExchange = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmittingExchange(true);
      setError(null);

      // Validate inputs
      if (!newExchangeName) {
        throw new Error('Please select an exchange');
      }

      if (!newExchangeApiKey) {
        throw new Error('API Key is required');
      }

      if (!newExchangeApiSecret) {
        throw new Error('API Secret is required');
      }

      // Add exchange
      const { data, error } = await supabase
        .from('exchanges')
        .insert({
          name: newExchangeName,
          api_key: newExchangeApiKey,
          api_secret: newExchangeApiSecret,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Reset form
      setNewExchangeName('binance');
      setNewExchangeApiKey('');
      setNewExchangeApiSecret('');
      setShowAddExchangeForm(false);

      // Reload exchanges
      await loadExchanges();

      setSuccess('Exchange added successfully');
      setTimeout(() => setSuccess(null), 3000);

      setIsSubmittingExchange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add exchange');
      setIsSubmittingExchange(false);
    }
  };

  // Render loading state
  if (loading && exchanges.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
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
      <div>
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <p className="text-gray-400">Configure your trading environment</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 flex-shrink-0" />
          <p>{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-green-400 hover:text-green-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Trading Mode Section */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-turquoise">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold gradient-text">Trading Mode</h2>
            <p className="text-sm text-gray-400">
              Switch between demo and live trading
            </p>
          </div>
        </div>


      </div>

      {/* Exchange Management Section */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-turquoise">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text">Exchange Management</h2>
              <p className="text-sm text-gray-400">
                Connect and manage your exchanges
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddExchangeForm(!showAddExchangeForm)}
            className="px-3 py-1 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-all duration-300 text-sm"
          >
            {showAddExchangeForm ? 'Cancel' : 'Add Exchange'}
          </button>
        </div>

        {/* Add Exchange Form */}
        {showAddExchangeForm && (
          <form onSubmit={handleAddExchange} className="bg-gunmetal-800/50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label htmlFor="exchangeName" className="block text-sm font-medium text-gray-300 mb-1">
                Exchange
              </label>
              <select
                id="exchangeName"
                value={newExchangeName}
                onChange={(e) => setNewExchangeName(e.target.value)}
                className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                required
              >
                <option value="binance">Binance</option>
                <option value="bybit">ByBit</option>
                <option value="bitmart">Bitmart</option>
                <option value="bitget">Bitget</option>
                <option value="okx">OKX</option>
                <option value="coinbase">Coinbase</option>
                <option value="kraken">Kraken</option>
              </select>
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="text"
                id="apiKey"
                value={newExchangeApiKey}
                onChange={(e) => setNewExchangeApiKey(e.target.value)}
                className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-300 mb-1">
                API Secret
              </label>
              <input
                type="password"
                id="apiSecret"
                value={newExchangeApiSecret}
                onChange={(e) => setNewExchangeApiSecret(e.target.value)}
                className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingExchange}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmittingExchange ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Add Exchange
                </>
              )}
            </button>
          </form>
        )}

        {/* Exchanges List */}
        {exchanges.length === 0 ? (
          <div className="bg-gunmetal-800/50 rounded-lg p-6 text-center">
            <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Exchanges Connected</h3>
            <p className="text-gray-400 mb-4">
              Connect an exchange to start trading with real funds
            </p>
            <button
              onClick={() => setShowAddExchangeForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Key className="w-4 h-4" />
              Add Exchange
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {exchanges.map(exchange => (
              <div
                key={exchange.id}
                className={`bg-gunmetal-800/50 rounded-lg p-4 flex items-center justify-between ${
                  activeExchange?.id === exchange.id ? 'border border-neon-turquoise/30' : ''
                }`}
              >
                <div>
                  <p className="font-medium text-gray-200 capitalize">
                    {exchange.name}
                    {activeExchange?.id === exchange.id && (
                      <span className="ml-2 text-xs text-neon-turquoise">Active</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Added {new Date(exchange.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  {activeExchange?.id !== exchange.id && (
                    <button
                      onClick={() => handleSetActiveExchange(exchange.id)}
                      className="p-1 text-gray-400 hover:text-neon-turquoise"
                      title="Set as active"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleRemoveExchange(exchange.id)}
                    className="p-1 text-gray-400 hover:text-neon-pink"
                    title="Remove exchange"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
