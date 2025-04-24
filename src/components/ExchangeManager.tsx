import { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Wallet,
  Shield,
  AlertTriangle,
  Trash2,
  Plus,
  RefreshCw,
  Check,
  Edit,
  Power,
  PowerOff
} from 'lucide-react';
import { Button } from './ui/Button';
import { AddExchangeModal } from './AddExchangeModal';
import { EditExchangeModal } from './EditExchangeModal';
import { ExchangeConnectionSettings } from './ExchangeConnectionSettings';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';
import { tradeService } from '../lib/trade-service';
import { eventBus } from '../lib/event-bus';

import type { Exchange, ExchangeConfig } from '../lib/types';

interface ExchangeManagerProps {
  onExchangeAdd?: (exchange: ExchangeConfig) => void;
  onExchangeRemove?: (exchangeId: string) => void;
  onExchangeConnect?: (exchange: Exchange) => void;
  onExchangeDisconnect?: () => void;
}

export function ExchangeManager({
  onExchangeAdd,
  onExchangeRemove,
  onExchangeConnect,
  onExchangeDisconnect
}: ExchangeManagerProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExchange, setEditingExchange] = useState<Exchange | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [activeExchange, setActiveExchange] = useState<Exchange | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [supportedExchanges, setSupportedExchanges] = useState<string[]>([]);

  const loadExchanges = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      setSuccess(null); // Clear any previous success messages

      // Load exchanges from the exchange service
      const userExchanges = await exchangeService.getUserExchanges();
      setExchanges(userExchanges || []);

      // Get the active exchange from the exchange service
      const active = await exchangeService.getActiveExchange();
      setActiveExchange(active);

      logService.log('info', 'Loaded exchanges', {
        count: userExchanges?.length || 0,
        activeExchange: active?.id || 'none'
      }, 'ExchangeManager');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load exchanges';
      setError(errorMessage);
      logService.log('error', 'Failed to load exchanges:', err, 'ExchangeManager');
    } finally {
      setLoading(false);
    }
  };

  // Handle exchange connected event
  const handleExchangeConnected = (exchange: Exchange) => {
    setActiveExchange(exchange);
    setIsConnecting(false);
    setSuccess(`Successfully connected to ${exchange.name}`);
    if (onExchangeConnect) {
      onExchangeConnect(exchange);
    }
  };

  // Handle exchange disconnected event
  const handleExchangeDisconnected = () => {
    setActiveExchange(null);
    setIsDisconnecting(false);
    setSuccess('Successfully disconnected from exchange');
    if (onExchangeDisconnect) {
      onExchangeDisconnect();
    }
  };

  // Load supported exchanges
  const loadSupportedExchanges = async () => {
    try {
      const supported = await exchangeService.getSupportedExchanges();
      setSupportedExchanges(supported.map(ex => ex.toLowerCase()));
    } catch (err) {
      logService.log('error', 'Failed to load supported exchanges', err, 'ExchangeManager');
    }
  };

  useEffect(() => {
    loadExchanges();
    loadSupportedExchanges();

    // Subscribe to exchange events
    const subscriptions = [
      eventBus.on('exchange:connected', handleExchangeConnected),
      eventBus.on('exchange:disconnected', handleExchangeDisconnected),
      eventBus.on('exchange:added', () => loadExchanges()),
      eventBus.on('exchange:updated', () => loadExchanges()),
      eventBus.on('exchange:removed', () => loadExchanges())
    ];

    return () => {
      // Unsubscribe from events
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const handleRemoveExchange = async (exchangeId: string) => {
    if (!window.confirm('Are you sure you want to delete this exchange?')) {
      return;
    }

    try {
      setIsDeleting(exchangeId);
      setError(null);

      // Check if this is the active exchange
      const exchangeToRemove = exchanges.find(e => e.id === exchangeId);
      const isActive = activeExchange?.id === exchangeId;

      // If this is the active exchange, disconnect first
      if (isActive) {
        await handleDisconnectExchange();
      }

      // Remove the exchange
      await exchangeService.removeExchange(exchangeId);

      // Show success message
      setSuccess(`Successfully removed ${exchangeToRemove?.name || 'exchange'}`);

      // Reload exchanges
      await loadExchanges();

      // Notify parent component
      if (onExchangeRemove) {
        onExchangeRemove(exchangeId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove exchange';
      setError(errorMessage);
      logService.log('error', 'Failed to remove exchange:', err, 'ExchangeManager');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAddExchange = async (config: ExchangeConfig) => {
    setTestingConnection(true);
    setError(null); // Clear any previous errors

    try {
      // First test the connection
      logService.log('info', 'Testing connection to exchange', {
        exchange: config.name,
        testnet: config.testnet
      }, 'ExchangeManager');

      await exchangeService.testConnection({
        name: config.name.toLowerCase(),
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo,
        testnet: config.testnet,
        useUSDX: config.useUSDX
      });

      logService.log('info', 'Connection test successful', null, 'ExchangeManager');

      // If test succeeds, add the exchange
      await exchangeService.addExchange(config);

      // Reload the exchanges list
      await loadExchanges();

      // Notify parent component if callback provided
      if (onExchangeAdd) {
        onExchangeAdd(config);
      }

      // Show success message
      setSuccess(`Successfully connected to ${config.name}${config.testnet ? ' TestNet' : ''}`);

      // Close the modal
      setShowAddModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add exchange';
      setError(errorMessage);
      logService.log('error', 'Failed to add exchange', err, 'ExchangeManager');
      // Don't throw the error, just log it and show in the UI
    } finally {
      setTestingConnection(false);
    }
  };

  // Connect to an exchange
  const handleConnectExchange = async (exchange: Exchange) => {
    try {
      setIsConnecting(true);
      setError(null);
      setSuccess(null);

      // Disconnect from current exchange if connected
      if (activeExchange) {
        await exchangeService.disconnect();
      }

      // Reset any active strategies
      // @ts-ignore - The resetActiveStrategies method exists but TypeScript doesn't recognize it
      await tradeService.resetActiveStrategies();

      // Connect to the new exchange
      await exchangeService.connect(exchange);

      // Set as default exchange
      await exchangeService.setDefaultExchange(exchange.id);

      // Success will be set by the event handler
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to exchange';
      setError(errorMessage);
      setIsConnecting(false);
      logService.log('error', 'Failed to connect to exchange', err, 'ExchangeManager');
    }
  };

  // Disconnect from the active exchange
  const handleDisconnectExchange = async () => {
    try {
      setIsDisconnecting(true);
      setError(null);
      setSuccess(null);

      // Reset any active strategies
      // @ts-ignore - The resetActiveStrategies method exists but TypeScript doesn't recognize it
      await tradeService.resetActiveStrategies();

      // Disconnect from the exchange
      await exchangeService.disconnect();

      // Success will be set by the event handler
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from exchange';
      setError(errorMessage);
      setIsDisconnecting(false);
      logService.log('error', 'Failed to disconnect from exchange', err, 'ExchangeManager');
    }
  };



  const handleEditExchange = async (config: ExchangeConfig, exchangeId: string) => {
    setTestingConnection(true);
    setError(null); // Clear any previous errors

    try {
      // First test the connection
      logService.log('info', 'Testing connection to exchange', {
        exchange: config.name,
        testnet: config.testnet
      }, 'ExchangeManager');

      await exchangeService.testConnection({
        name: config.name.toLowerCase(),
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo,
        testnet: config.testnet,
        useUSDX: config.useUSDX
      });

      logService.log('info', 'Connection test successful', null, 'ExchangeManager');

      // If test succeeds, update the exchange
      await exchangeService.updateExchange(exchangeId, config);

      // Reload the exchanges list
      await loadExchanges();

      // Show success message
      setSuccess(`Successfully updated ${config.name}${config.testnet ? ' TestNet' : ''} credentials`);

      // Close the modal
      setShowEditModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update exchange';
      setError(errorMessage);
      logService.log('error', 'Failed to update exchange', err, 'ExchangeManager');
      // Don't throw the error, just log it and show in the UI
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

      {/* Connection Settings */}
      <ExchangeConnectionSettings />

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

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <p>{success}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {exchanges.map((exchange) => {
            const isActive = activeExchange?.id === exchange.id;
            return (
              <div
                key={exchange.id}
                className={`panel-metallic rounded-lg p-6 flex items-center justify-between hover:bg-gunmetal-800/70 transition-colors`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${isActive ? 'bg-neon-turquoise/20' : 'bg-gunmetal-900/50'} p-3 rounded-lg`}>
                    <Wallet className={`w-5 h-5 ${isActive ? 'text-neon-turquoise' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-200">{exchange.name}</h3>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-neon-turquoise/20 text-neon-turquoise text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{exchange.memo || 'No memo'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectExchange()}
                      disabled={isDisconnecting}
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10 mr-2"
                    >
                      {isDisconnecting ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <PowerOff className="w-4 h-4 mr-1" />
                      )}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectExchange(exchange)}
                      disabled={isConnecting}
                      className="text-neon-turquoise border-neon-turquoise/30 hover:bg-neon-turquoise/10 mr-2"
                    >
                      {isConnecting ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-1" />
                      )}
                      Connect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingExchange(exchange);
                      setShowEditModal(true);
                    }}
                    className="hover:bg-blue-500/10 hover:text-blue-400 mr-2"
                    title="Edit Exchange Credentials"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveExchange(exchange.id)}
                    className="hover:bg-red-500/10 hover:text-red-400"
                    disabled={isActive || isDeleting === exchange.id} // Can't remove the active exchange
                    title="Remove Exchange"
                  >
                    {isDeleting === exchange.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}

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
        supportedExchanges={supportedExchanges}
      />

      {/* Edit Exchange Modal */}
      <EditExchangeModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingExchange(null);
        }}
        onSave={handleEditExchange}
        exchange={editingExchange}
        isTesting={testingConnection}
      />
    </div>
  );
}
