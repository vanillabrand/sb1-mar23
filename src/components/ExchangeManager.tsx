import React, { useState, useEffect } from 'react';
import { 
  CircleDollarSign, 
  Wallet,
  Shield, 
  AlertTriangle,
  Trash2,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/Button';
import { AddExchangeModal } from './AddExchangeModal';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';
import { supabase } from '../lib/supabase';
import type { Exchange, ExchangeConfig } from '../lib/types';

interface ExchangeManagerProps {
  onExchangeAdd?: (exchange: ExchangeConfig) => void;
  onExchangeRemove?: (exchangeId: string) => void;
}

export function ExchangeManager({ onExchangeAdd, onExchangeRemove }: ExchangeManagerProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const loadExchanges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_exchanges')
        .select('*');

      if (error) throw error;
      setExchanges(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load exchanges';
      setError(errorMessage);
      logService.log('error', 'Failed to load exchanges:', err, 'ExchangeManager');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExchanges();
  }, []);

  const handleRemoveExchange = async (exchangeId: string) => {
    try {
      await exchangeService.removeExchange(exchangeId);
      await loadExchanges();
      if (onExchangeRemove) {
        onExchangeRemove(exchangeId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove exchange';
      setError(errorMessage);
      logService.log('error', 'Failed to remove exchange:', err, 'ExchangeManager');
    }
  };

  const handleAddExchange = async (config: ExchangeConfig) => {
    setTestingConnection(true);
    try {
      // First test the connection
      await exchangeService.testConnection({
        name: config.name.toLowerCase(),
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo,
        testnet: config.testnet,
        useUSDX: config.useUSDX
      });

      // If test succeeds, add the exchange
      await exchangeService.addExchange(config);
      await loadExchanges();
      
      if (onExchangeAdd) {
        onExchangeAdd(config);
      }
      
      setShowAddModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add exchange';
      setError(errorMessage);
      throw err;
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Exchange Manager</h2>
        <p className="text-sm text-gray-400">
          Connect and manage your exchange accounts. Configure API credentials and monitor exchange connectivity status.
        </p>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected Exchanges</p>
              <p className="text-2xl font-bold text-gray-200">
                {exchanges.length}
              </p>
            </div>
            <CircleDollarSign className="w-8 h-8 text-neon-turquoise" />
          </div>
        </div>

        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Status</p>
              <p className="text-2xl font-bold text-gray-200">
                {exchanges.length > 0 ? 'Connected' : 'Not Connected'}
              </p>
            </div>
            <Shield className="w-8 h-8 text-neon-yellow" />
          </div>
        </div>

        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Last Updated</p>
              <p className="text-2xl font-bold text-gray-200">
                Just Now
              </p>
            </div>
            <RefreshCw className="w-8 h-8 text-neon-pink" />
          </div>
        </div>
      </div>

      {/* Exchanges Section */}
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">Connected Exchanges</h2>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            Add Exchange
          </Button>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {exchanges.map((exchange) => (
            <div
              key={exchange.id}
              className="bg-gunmetal-800/50 rounded-lg p-6 flex items-center justify-between hover:bg-gunmetal-800/70 transition-colors border border-gunmetal-700"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                  <Wallet className="w-5 h-5 text-neon-turquoise" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-200">{exchange.name}</h3>
                  <p className="text-sm text-gray-400">{exchange.memo || 'No memo'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveExchange(exchange.id)}
                  className="hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {!loading && exchanges.length === 0 && (
            <div className="text-center py-12 bg-gunmetal-900/30 rounded-lg border border-gunmetal-800/30">
              <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 font-medium">No exchanges configured</p>
              <p className="text-sm text-gray-400 mt-1">Click "Add Exchange" to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Exchange Modal */}
      <AddExchangeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddExchange}
        isTesting={testingConnection}
        supportedExchanges={['binance', 'bybit', 'okx', 'bitmart', 'bitget', 'coinbase', 'kraken']}
      />
    </div>
  );
}
