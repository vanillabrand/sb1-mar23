import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Key,
  Lock,
  Globe,
  AlertCircle,
  Info,
  Loader2,
  Plus,
  X,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Coins,
  Briefcase,
  Power
} from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { SUPPORTED_EXCHANGES } from '../lib/types';
import { ExchangeGuide } from './ExchangeGuide';
import { ExchangeHealth } from './ExchangeHealth';
import { logService } from '../lib/log-service';

interface WalletConfig {
  id: string;
  name: string;
  exchangeId: string;
  apiKey: string;
  secret: string;
  memo?: string;
  isActive: boolean;
  createdAt: Date;
}

interface AssetBalance {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
}

const WalletManager = () => {
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [memo, setMemo] = useState('');
  const [walletName, setWalletName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedExchange, setConnectedExchange] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ total: number; available: number } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [useUSDX, setUseUSDX] = useState(false);
  const [wallets, setWallets] = useState<WalletConfig[]>([]);
  const [activeWallet, setActiveWallet] = useState<WalletConfig | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editWallet, setEditWallet] = useState<WalletConfig | null>(null);
  const [assets, setAssets] = useState<AssetBalance[]>([]);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  useEffect(() => {
    loadSavedWallets();
    initializeExchange();
  }, []);

  const loadSavedWallets = () => {
    try {
      const savedWallets = localStorage.getItem('wallets');
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets);
        const walletsWithDates = parsed.map((wallet: any) => ({
          ...wallet,
          createdAt: new Date(wallet.createdAt)
        }));
        setWallets(walletsWithDates);
        
        const active = walletsWithDates.find((w: WalletConfig) => w.isActive);
        if (active) {
          setActiveWallet(active);
          setConnectedExchange(active.exchangeId);
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to load saved wallets', error, 'WalletManager');
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
      }
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'WalletManager');
    }
  };

  const fetchBalance = async () => {
    try {
      setIsLoadingBalance(true);
      setBalanceError(null);
      const balanceData = await exchangeService.fetchBalance();
      setBalance(balanceData);
    } catch (error) {
      setBalanceError('Failed to fetch balance');
      logService.log('error', 'Failed to fetch balance', error, 'WalletManager');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);

    try {
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

      // Fetch initial balance
      await fetchBalance();
      setConnectedExchange(selectedExchange);

      // Clear form
      setApiKey('');
      setSecret('');
      setMemo('');
      setShowWalletModal(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect to exchange');
      exchangeService.setCredentials(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExchange || !walletName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const newWallet: WalletConfig = {
        id: Date.now().toString(),
        name: walletName,
        exchangeId: selectedExchange,
        apiKey,
        secret,
        memo,
        isActive: wallets.length === 0,
        createdAt: new Date()
      };

      // If this is the first wallet or user wants to make it active
      if (newWallet.isActive) {
        await exchangeService.initializeExchange({
          name: selectedExchange,
          apiKey,
          secret,
          memo,
          testnet: false,
          useUSDX
        });

        setActiveWallet(newWallet);
        setConnectedExchange(selectedExchange);
      }

      const updatedWallets = [...wallets.map(w => ({ ...w, isActive: false })), newWallet];
      setWallets(updatedWallets);
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));

      setWalletName('');
      setApiKey('');
      setSecret('');
      setMemo('');
      setShowWalletModal(false);
      setSelectedExchange(null);

      logService.log('info', 'Added new wallet successfully', null, 'WalletManager');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add wallet');
      logService.log('error', 'Failed to add wallet', error, 'WalletManager');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEditWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWallet) return;

    try {
      setIsConnecting(true);
      setError(null);

      const updatedWallet = {
        ...editWallet,
        name: walletName,
        apiKey,
        secret,
        memo
      };

      // Update wallet in list
      const updatedWallets = wallets.map(w => 
        w.id === editWallet.id ? updatedWallet : w
      );

      setWallets(updatedWallets);
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));

      // If editing active wallet, update credentials
      if (updatedWallet.isActive) {
        await exchangeService.initializeExchange({
          name: updatedWallet.exchangeId,
          apiKey: updatedWallet.apiKey,
          secret: updatedWallet.secret,
          memo: updatedWallet.memo,
          testnet: false,
          useUSDX
        });
        setActiveWallet(updatedWallet);
      }

      setWalletName('');
      setApiKey('');
      setSecret('');
      setMemo('');
      setEditWallet(null);
      setIsEditing(false);
      setShowWalletModal(false);
      setSelectedExchange(null);

      logService.log('info', `Updated wallet ${editWallet.id}`, null, 'WalletManager');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update wallet');
      logService.log('error', `Failed to update wallet ${editWallet.id}`, error, 'WalletManager');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      const walletToDelete = wallets.find(w => w.id === id);
      if (!walletToDelete) return;

      // Remove wallet from list
      const updatedWallets = wallets.filter(w => w.id !== id);
      setWallets(updatedWallets);

      // If deleting active wallet
      if (walletToDelete.isActive) {
        if (updatedWallets.length > 0) {
          const newActiveWallet = { ...updatedWallets[0], isActive: true };
          const walletsWithNewActive = updatedWallets.map((w, i) => 
            i === 0 ? newActiveWallet : w
          );

          setWallets(walletsWithNewActive);
          setActiveWallet(newActiveWallet);
          localStorage.setItem('wallets', JSON.stringify(walletsWithNewActive));

          // Initialize new active wallet
          await exchangeService.initializeExchange({
            name: newActiveWallet.exchangeId,
            apiKey: newActiveWallet.apiKey,
            secret: newActiveWallet.secret,
            memo: newActiveWallet.memo,
            testnet: false,
            useUSDX
          });
        } else {
          setActiveWallet(null);
          setConnectedExchange(null);
          exchangeService.setCredentials(null);
        }
      }

      localStorage.setItem('wallets', JSON.stringify(updatedWallets));
      logService.log('info', `Deleted wallet ${id}`, null, 'WalletManager');
    } catch (error) {
      setError('Failed to delete wallet');
      logService.log('error', `Failed to delete wallet ${id}`, error, 'WalletManager');
    }
  };

  const setWalletAsActive = async (id: string) => {
    try {
      const walletToActivate = wallets.find(w => w.id === id);
      if (!walletToActivate) return;

      const updatedWallets = wallets.map(w => ({
        ...w,
        isActive: w.id === id
      }));

      setWallets(updatedWallets);
      setActiveWallet(walletToActivate);
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));

      await exchangeService.initializeExchange({
        name: walletToActivate.exchangeId,
        apiKey: walletToActivate.apiKey,
        secret: walletToActivate.secret,
        memo: walletToActivate.memo,
        testnet: false,
        useUSDX
      });

      setConnectedExchange(walletToActivate.exchangeId);
      await fetchBalance();

      logService.log('info', `Set wallet ${id} as active`, null, 'WalletManager');
    } catch (error) {
      setError('Failed to set wallet as active');
      logService.log('error', `Failed to set wallet ${id} as active`, error, 'WalletManager');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Wallet Manager</h2>
        <p className="text-sm text-gray-400">
          Connect and manage your exchange wallets. Monitor balances, track assets, and configure API credentials for automated trading.
        </p>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected Exchange</p>
              <p className="text-2xl font-bold text-gray-200">
                {connectedExchange ? SUPPORTED_EXCHANGES.find(e => e.id === connectedExchange)?.name : 'Not Connected'}
              </p>
            </div>
            <Globe className="w-8 h-8 text-neon-turquoise" />
          </div>
          <div className="mt-4">
            <ExchangeHealth />
          </div>
        </div>

        {balance && (
          <>
            <div className="bg-gunmetal-800/20 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Balance</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-gray-200">
                      {useUSDX ? 'USDX ' : '$'}{balance.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {isLoadingBalance && (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
                <Wallet className="w-8 h-8 text-neon-turquoise" />
              </div>
              {balanceError ? (
                <div className="mt-4 text-sm text-neon-pink">{balanceError}</div>
              ) : (
                <div className="mt-4 flex items-center text-sm">
                  <ArrowUpRight className="w-4 h-4 text-neon-orange" />
                  <span className="text-neon-orange font-medium">+2.5%</span>
                  <span className="text-gray-400 ml-2">today</span>
                </div>
              )}
            </div>

            <div className="bg-gunmetal-800/20 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Available Balance</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-gray-200">
                      {useUSDX ? 'USDX ' : '$'}{balance.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {isLoadingBalance && (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
                <Lock className="w-8 h-8 text-neon-turquoise" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <ArrowDownRight className="w-4 h-4 text-neon-pink" />
                <span className="text-neon-pink font-medium">
                  {useUSDX ? 'USDX ' : '$'}{(balance.total - balance.available).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-gray-400 ml-2">in open positions</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Wallets Section */}
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">My Wallets</h2>
          <button 
            onClick={() => {
              setShowWalletModal(true);
              setIsEditing(false);
              setWalletName('');
              setApiKey('');
              setSecret('');
              setMemo('');
              setSelectedExchange(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            Add Wallet
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Briefcase className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="mb-4">No wallets configured yet. Add your first wallet to start trading.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="bg-gunmetal-800/50 rounded-lg border border-gunmetal-700">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedWallet(expandedWallet === wallet.id ? null : wallet.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedWallet === wallet.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-200">{wallet.name}</h3>
                        {wallet.isActive && (
                          <span className="bg-neon-turquoise/20 text-neon-turquoise text-xs px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {SUPPORTED_EXCHANGES.find(e => e.id === wallet.exchangeId)?.name || wallet.exchangeId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!wallet.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWalletAsActive(wallet.id);
                        }}
                        className="p-2 text-gray-400 hover:text-neon-turquoise transition-colors"
                        title="Set as active"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditWallet(wallet);
                        setWalletName(wallet.name);
                        setApiKey(wallet.apiKey);
                        setSecret(wallet.secret);
                        setMemo(wallet.memo || '');
                        setIsEditing(true);
                        setShowWalletModal(true);
                        setSelectedExchange(wallet.exchangeId);
                      }}
                      className="p-2 text-gray-400 hover:text-neon-yellow transition-colors"
                      title="Edit wallet"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWallet(wallet.id);
                      }}
                      className="p-2 text-gray-400 hover:text-neon-pink transition-colors"
                      title="Delete wallet"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {expandedWallet === wallet.id && (
                  <div className="p-4 pt-0 border-t border-gunmetal-700 mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Portfolio Assets</h4>
                    
                    {isLoadingAssets ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 text-neon-turquoise animate-spin" />
                      </div>
                    ) : assets.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gunmetal-700">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Balance</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gunmetal-700">
                            {assets.map((asset) => (
                              <tr key={asset.symbol} className="hover:bg-gunmetal-700/30">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="ml-2">
                                      <div className="font-medium text-gray-200">{asset.symbol}</div>
                                      <div className="text-xs text-gray-400">{asset.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-200">
                                  {asset.balance.toLocaleString(undefined, {
                                    minimumFractionDigits: asset.symbol === 'BTC' ? 8 : 2,
                                    maximumFractionDigits: asset.symbol === 'BTC' ? 8 : 2
                                  })}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-200">
                                  ${asset.value.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap text-right font-mono ${
                                  asset.change24h >= 0 ? 'text-neon-orange' : 'text-neon-pink'
                                }`}>
                                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400">
                        No assets found for this wallet.
                      </div>
                    )}
                    
                    {/* Key Details */}
                    <div className="mt-4 pt-4 border-t border-gunmetal-700">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Wallet Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Connected Since</p>
                          <p className="text-sm font-medium text-gray-200">
                            {wallet.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="bg-gunmetal-900/50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">API Key</p>
                          <p className="text-sm font-medium text-gray-200">
                            {wallet.apiKey.substring(0, 4)}...{wallet.apiKey.substring(wallet.apiKey.length - 4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold gradient-text">
                {isEditing ? 'Edit Wallet' : 'Add New Wallet'}
              </h2>
              <button
                onClick={() => {
                  setShowWalletModal(false);
                  setIsEditing(false);
                  setEditWallet(null);
                  setSelectedExchange(null);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={isEditing ? handleEditWallet : handleAddWallet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Name
                </label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  placeholder="My Trading Wallet"
                  required
                />
              </div>

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

                  <div className="flex items-center pt-4">
                    <input
                      type="checkbox"
                      id="set-active"
                      className="h-4 w-4 rounded border-gunmetal-700 bg-gunmetal-800 text-neon-turquoise focus:ring-neon-turquoise"
                      defaultChecked={!activeWallet}
                      disabled={!activeWallet}
                    />
                    <label htmlFor="set-active" className="ml-2 block text-sm text-gray-300">
                      Set as active wallet
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt- 4 border-t border-gunmetal-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletModal(false);
                    setIsEditing(false);
                    setEditWallet(null);
                    setSelectedExchange(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
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
                      {isEditing ? 'Updating...' : 'Connecting...'}
                    </>
                  ) : (
                    <>
                      {isEditing ? 'Save Changes' : 'Add Wallet'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exchange Guide */}
      {selectedExchange && (
        <ExchangeGuide exchangeId={selectedExchange} />
      )}
    </div>
  );
};

export default WalletManager;