import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2,
  Power,
  Key,
  Globe,
  AlertCircle,
  Info,
  Loader2,
  Plus,
  X,
  Trash2,
  Edit2,
  ChevronRight,
  CheckCircle,
  Coins,
  Briefcase,
  WifiOff,
  Wifi,
  AlertTriangle
} from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { SUPPORTED_EXCHANGES } from '../lib/types';
import { ExchangeGuide } from './ExchangeGuide';
import { ExchangeHealth } from './ExchangeHealth';
import { ExchangeBalances } from './ExchangeBalances';
import { logService } from '../lib/log-service';
import CryptoJS from 'crypto-js';

interface ExchangeConfig {
  id: string;
  name: string;
  exchangeId: string;
  apiKey: string;
  secret: string;
  memo?: string;
  isActive: boolean;
  createdAt: Date;
}

interface ApiStatus {
  code: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const ExchangeManager = () => {
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [memo, setMemo] = useState('');
  const [exchangeName, setExchangeName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [connectedExchange, setConnectedExchange] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ total: number; available: number } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [useUSDX, setUseUSDX] = useState(false);
  const [exchanges, setExchanges] = useState<ExchangeConfig[]>([]);
  const [activeExchange, setActiveExchange] = useState<ExchangeConfig | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editExchange, setEditExchange] = useState<ExchangeConfig | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [expandedExchange, setExpandedExchange] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [validationStep, setValidationStep] = useState<string>('');

  useEffect(() => {
    loadSavedExchanges();
    initializeExchange();
  }, []);

  const loadSavedExchanges = () => {
    try {
      const savedExchanges = localStorage.getItem('exchanges');
      if (savedExchanges) {
        const parsed = JSON.parse(savedExchanges);
        const exchangesWithDates = parsed.map((exchange: any) => ({
          ...exchange,
          createdAt: new Date(exchange.createdAt)
        }));
        setExchanges(exchangesWithDates);
        
        const active = exchangesWithDates.find((e: ExchangeConfig) => e.isActive);
        if (active) {
          setActiveExchange(active);
          setConnectedExchange(active.exchangeId);
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to load saved exchanges', error, 'ExchangeManager');
      setError('Failed to load saved exchanges. Please try again.');
    }
  };

  const initializeExchange = async () => {
    try {
      const credentials = exchangeService.getCredentials();
      if (credentials) {
        await exchangeService.initializeExchange({
          name: 'bitmart',
          apiKey: credentials.apiKey,
          secret: credentials.secret,
          memo: credentials.memo || '',
          testnet: false,
          useUSDX: false
        });
        await fetchBalance();
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'ExchangeManager');
      setError('Failed to initialize exchange connection. Please check your credentials.');
      setIsLive(false);
    }
  };

  const validateApiCredentials = async (apiKey: string, secret: string, memo: string): Promise<boolean> => {
    try {
      setValidationStep('Validating API credentials...');
      
      // Generate signature
      const timestamp = Date.now().toString();
      const signString = `${timestamp}#${memo}#balance`;
      const signature = CryptoJS.HmacSHA256(signString, secret).toString();

      // Test API endpoint with proper authentication
      const response = await fetch('https://api-cloud.bitmart.com/spot/v1/wallet', {
        headers: {
          'X-BM-KEY': apiKey,
          'X-BM-SIGN': signature,
          'X-BM-TIMESTAMP': timestamp,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      setApiStatus({
        code: response.status,
        message: data.message || response.statusText,
        type: response.ok ? 'success' : 'error'
      });

      if (!response.ok || data.code !== 1000) {
        throw new Error(data.message || `API Error (${response.status}): ${response.statusText}`);
      }

      setValidationStep('API credentials validated successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'API validation failed';
      setError(errorMessage);
      setValidationStep('API validation failed');
      return false;
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);
    setApiStatus(null);
    setValidationStep('Starting connection process...');

    try {
      // Validate credentials first
      const isValid = await validateApiCredentials(apiKey, secret, memo);
      if (!isValid) {
        throw new Error('Invalid API credentials');
      }

      setValidationStep('Initializing exchange connection...');

      // Save credentials
      exchangeService.setCredentials({ apiKey, secret, memo });

      // Initialize exchange
      await exchangeService.initializeExchange({
        name: selectedExchange || 'bitmart',
        apiKey,
        secret,
        memo,
        testnet: false,
        useUSDX
      });

      setValidationStep('Testing connection...');

      // Test connection by fetching balance
      await fetchBalance();
      setConnectedExchange(selectedExchange);
      setIsLive(true);

      setValidationStep('Connection successful!');

      // Clear form and close modal
      setApiKey('');
      setSecret('');
      setMemo('');
      setShowExchangeModal(false);

      // Show success status
      setApiStatus({
        code: 200,
        message: 'Successfully connected to exchange',
        type: 'success'
      });

      logService.log('info', 'Successfully connected to exchange', null, 'ExchangeManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to exchange';
      setError(errorMessage);
      setApiStatus({
        code: 500,
        message: errorMessage,
        type: 'error'
      });
      exchangeService.setCredentials(null);
      setIsLive(false);
      logService.log('error', 'Failed to connect to exchange', error, 'ExchangeManager');
    } finally {
      setIsConnecting(false);
      setValidationStep('');
    }
  };

  const handleDisconnect = async () => {
    try {
      // Clear credentials
      exchangeService.setCredentials(null);
      
      // Initialize in demo mode
      await exchangeService.initializeExchange({
        name: 'bitmart',
        apiKey: 'demo',
        secret: 'demo',
        memo: 'demo',
        testnet: true,
        useUSDX: false
      });

      setConnectedExchange(null);
      setActiveExchange(null);
      setIsLive(false);
      
      setApiStatus({
        code: 200,
        message: 'Successfully disconnected from exchange',
        type: 'success'
      });

      logService.log('info', 'Successfully disconnected from exchange', null, 'ExchangeManager');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect from exchange';
      setError(errorMessage);
      setApiStatus({
        code: 500,
        message: errorMessage,
        type: 'error'
      });
      logService.log('error', 'Failed to disconnect from exchange', error, 'ExchangeManager');
    }
  };

  const fetchBalance = async () => {
    try {
      setIsLoadingBalance(true);
      setBalanceError(null);
      const balanceData = await exchangeService.fetchBalance();
      setBalance(balanceData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch balance';
      setBalanceError(errorMessage);
      logService.log('error', 'Failed to fetch balance', error, 'ExchangeManager');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const getStatusColor = (type: ApiStatus['type']) => {
    switch (type) {
      case 'success': return 'bg-neon-turquoise/10 text-neon-turquoise';
      case 'error': return 'bg-neon-pink/10 text-neon-pink';
      case 'warning': return 'bg-neon-orange/10 text-neon-orange';
      case 'info': return 'bg-neon-yellow/10 text-neon-yellow';
    }
  };

  const getStatusIcon = (type: ApiStatus['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Exchange Manager</h2>
        <p className="text-sm text-gray-400">
          Connect and manage your exchange accounts. Monitor balances, track assets, and configure API credentials for automated trading.
        </p>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Exchange Status</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-200">
                  {connectedExchange ? SUPPORTED_EXCHANGES.find(e => e.id === connectedExchange)?.name : 'Not Connected'}
                </p>
                {isLive ? (
                  <span className="px-2 py-1 text-xs font-medium bg-neon-turquoise/20 text-neon-turquoise rounded-full">
                    Live
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-neon-yellow/20 text-neon-yellow rounded-full">
                    Demo
                  </span>
                )}
              </div>
            </div>
            <Globe className="w-8 h-8 text-neon-turquoise" />
          </div>
          <div className="mt-4">
            <ExchangeHealth />
          </div>
        </div>
      </div>

      {/* Connect/Disconnect Section */}
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Power className="w-6 h-6 text-neon-raspberry" />
            <h3 className="text-xl font-bold gradient-text">Exchange Connection</h3>
          </div>
          {isLive ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-neon-pink/10 text-neon-pink rounded-lg hover:bg-neon-pink/20 transition-all duration-300"
            >
              <WifiOff className="w-4 h-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowExchangeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
            >
              <Wifi className="w-4 h-4" />
              Connect Exchange
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className={`p-4 rounded-lg ${isLive ? 'bg-neon-turquoise/10' : 'bg-neon-yellow/10'}`}>
          <div className="flex items-center gap-3">
            {isLive ? (
              <Wifi className="w-5 h-5 text-neon-turquoise" />
            ) : (
              <Info className="w-5 h-5 text-neon-yellow" />
            )}
            <div>
              <h4 className={`font-medium ${isLive ? 'text-neon-turquoise' : 'text-neon-yellow'}`}>
                {isLive ? 'Live Trading Mode' : 'Demo Mode'}
              </h4>
              <p className="text-sm text-gray-400">
                {isLive 
                  ? 'Connected to exchange with real trading capabilities' 
                  : 'Running in demo mode with simulated trading'}
              </p>
            </div>
          </div>
        </div>

        {/* API Status */}
        {apiStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-lg ${getStatusColor(apiStatus.type)} flex items-center gap-3`}
          >
            {getStatusIcon(apiStatus.type)}
            <div>
              <p className="font-medium">Status Code: {apiStatus.code}</p>
              <p className="text-sm">{apiStatus.message}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Asset Balances */}
      <ExchangeBalances />

      {/* Connect Exchange Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold gradient-text">Connect Exchange</h2>
              <button
                onClick={() => {
                  setShowExchangeModal(false);
                  setSelectedExchange(null);
                  setError(null);
                  setApiStatus(null);
                  setValidationStep('');
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5" />
                {error}
              </motion.div>
            )}

            {validationStep && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-neon-turquoise/10 border border-neon-turquoise/20 text-neon-turquoise rounded-lg flex items-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                {validationStep}
              </motion.div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Exchange
                </label>
                <select
                  value={selectedExchange || ''}
                  onChange={(e) => setSelectedExchange(e.target.value || null)}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  required
                >
                  <option value="">Select Exchange</option>
                  {SUPPORTED_EXCHANGES.map(exchange => (
                    <option key={exchange.id} value={exchange.id}>
                      {exchange.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedExchange && (
                <>
                  {SUPPORTED_EXCHANGES.find(e => e.id === selectedExchange)?.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {field.name}
                      </label>
                      <input
                        type={field.type}
                        value={
                          field.key === 'apiKey' ? apiKey :
                          field.key === 'secret' ? secret :
                          field.key === 'memo' ? memo : ''
                        }
                        onChange={(e) => {
                          if (field.key === 'apiKey') setApiKey(e.target.value);
                          if (field.key === 'secret') setSecret(e.target.value);
                          if (field.key === 'memo') setMemo(e.target.value);
                        }}
                        className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    </div>
                  ))}
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gunmetal-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowExchangeModal(false);
                    setSelectedExchange(null);
                    setError(null);
                    setApiStatus(null);
                    setValidationStep('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                  disabled={isConnecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Exchange'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Exchange Guide */}
      {selectedExchange && (
        <ExchangeGuide exchangeId={selectedExchange} />
      )}
    </div>
  );
};

export default ExchangeManager;