import React, { useState, useEffect } from 'react';
import { Switch } from './ui/Switch';
import { userProfileService } from '../lib/user-profile-service';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import { eventBus } from '../lib/event-bus';
import { Shield, RefreshCw, Wifi, WifiOff, Globe, Info, Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ExchangeConnectionSettingsProps {
  className?: string;
}

export function ExchangeConnectionSettings({ className = '' }: ExchangeConnectionSettingsProps) {
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeExchange, setActiveExchange] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // Get auto-reconnect setting
        const autoReconnectSetting = await userProfileService.getAutoReconnect();
        setAutoReconnect(autoReconnectSetting);

        // Get user profile for connection status
        const profile = await userProfileService.getUserProfile();
        if (profile) {
          setConnectionStatus(profile.last_connection_status || 'disconnected');
          setConnectionError(profile.connection_error || null);
        }

        // Check if we're in demo mode
        const demoModeEnabled = demoService.isInDemoMode();
        setIsDemoMode(demoModeEnabled);

        // Get the active exchange
        const exchange = await exchangeService.getActiveExchange();
        setActiveExchange(exchange);

        // If we have an active exchange, update connection status
        if (exchange) {
          setConnectionStatus('connected');
        }
      } catch (error) {
        logService.log('error', 'Failed to load exchange connection settings', error, 'ExchangeConnectionSettings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Subscribe to exchange events
    const handleConnected = (data: any) => {
      setConnectionStatus('connected');
      setConnectionError(null);

      // Update active exchange
      if (data && data.exchange) {
        setActiveExchange(data.exchange);
      } else {
        // If no exchange data, get the active exchange
        exchangeService.getActiveExchange().then(exchange => {
          setActiveExchange(exchange);
        }).catch(err => {
          logService.log('error', 'Failed to get active exchange', err, 'ExchangeConnectionSettings');
        });
      }
    };

    const handleDisconnected = () => {
      setConnectionStatus('disconnected');
      setActiveExchange(null);
    };

    const handleError = (error: Error) => {
      setConnectionStatus('error');
      setConnectionError(error.message);
    };

    // Subscribe to demo mode changes
    const handleDemoModeChange = (enabled: boolean) => {
      setIsDemoMode(enabled);

      // If demo mode is enabled, update connection status
      if (enabled) {
        setConnectionStatus('connected');

        // Get the demo exchange
        exchangeService.getActiveExchange().then(exchange => {
          setActiveExchange(exchange);
        }).catch(err => {
          logService.log('error', 'Failed to get demo exchange', err, 'ExchangeConnectionSettings');
        });
      }
    };

    exchangeService.on('exchange:connected', handleConnected);
    exchangeService.on('exchange:disconnected', handleDisconnected);
    exchangeService.on('exchange:error', handleError);

    // Also subscribe to event bus events
    const unsubscribeConnected = eventBus.on('exchange:connected', handleConnected);
    const unsubscribeDisconnected = eventBus.on('exchange:disconnected', handleDisconnected);
    const unsubscribeDemoMode = eventBus.on('demo:mode:changed', handleDemoModeChange);

    return () => {
      exchangeService.off('exchange:connected', handleConnected);
      exchangeService.off('exchange:disconnected', handleDisconnected);
      exchangeService.off('exchange:error', handleError);

      // Unsubscribe from event bus events
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeDemoMode();
    };
  }, []);

  const handleAutoReconnectChange = async (checked: boolean) => {
    try {
      await userProfileService.setAutoReconnect(checked);
      setAutoReconnect(checked);
      toast.success(`Auto-reconnect ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logService.log('error', 'Failed to update auto-reconnect setting', error, 'ExchangeConnectionSettings');
      toast.error('Failed to update setting');
    }
  };

  const handleRetryConnection = async () => {
    try {
      setIsRetrying(true);

      // Get active exchange
      const activeExchange = await exchangeService.getActiveExchange();
      if (!activeExchange) {
        toast.error('No active exchange to reconnect to');
        return;
      }

      // Try to reconnect
      await exchangeService.connect(activeExchange);
      toast.success('Successfully reconnected to exchange');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.log('error', 'Failed to retry connection', error, 'ExchangeConnectionSettings');
      toast.error(`Failed to reconnect: ${errorMessage}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-neon-turquoise';
      case 'error': return 'text-neon-pink';
      default: return 'text-gray-400';
    }
  };

  const getStatusBg = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-neon-turquoise/10';
      case 'error': return 'bg-neon-pink/10';
      default: return 'bg-gunmetal-800';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-5 h-5 text-neon-turquoise" />;
      case 'error': return <WifiOff className="w-5 h-5 text-neon-pink" />;
      default: return <WifiOff className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className={`panel-metallic rounded-xl p-4 sm:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-neon-turquoise" />
        Exchange Connection Settings
      </h3>

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-300">Connection Status</h4>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusBg()}`}>
              {getStatusIcon()}
              <span className={`text-sm ${getStatusColor()}`}>
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Active Exchange Info */}
          {activeExchange && (
            <div className="mt-3 bg-gunmetal-700/30 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-neon-turquoise" />
                <div>
                  <h5 className="text-sm font-medium text-gray-200">
                    {activeExchange.name}
                    {activeExchange.testnet && (
                      <span className="ml-2 px-2 py-0.5 bg-neon-yellow/20 text-neon-yellow text-xs rounded-full">
                        TestNet
                      </span>
                    )}
                    {isDemoMode && (
                      <span className="ml-2 px-2 py-0.5 bg-neon-pink/20 text-neon-pink text-xs rounded-full">
                        Demo Mode
                      </span>
                    )}
                  </h5>
                  <p className="text-xs text-gray-400 mt-1">
                    {activeExchange.memo || 'No description'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {connectionError && (
            <div className="mt-2 text-sm text-neon-pink bg-neon-pink/5 p-3 rounded-lg">
              {connectionError}
            </div>
          )}

          {connectionStatus !== 'connected' && (
            <button
              onClick={handleRetryConnection}
              disabled={isRetrying || loading}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-neon-turquoise/20 text-neon-turquoise rounded-lg hover:bg-neon-turquoise/30 transition-colors disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </>
              )}
            </button>
          )}
        </div>

        {/* Demo Mode Status */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-neon-pink" />
                Demo Mode
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                {isDemoMode
                  ? 'Trading in demo mode with simulated funds'
                  : 'Trading with real exchange connection'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full ${isDemoMode ? 'bg-neon-pink/10 text-neon-pink' : 'bg-neon-turquoise/10 text-neon-turquoise'}`}>
              {isDemoMode ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Auto-Reconnect Setting */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-neon-yellow" />
                Auto-Reconnect
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Automatically reconnect to your exchange when you visit the site
              </p>
            </div>
            <Switch
              checked={autoReconnect}
              onCheckedChange={handleAutoReconnectChange}
              disabled={loading}
            />
          </div>
        </div>

        {/* VPN Recommendation */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-neon-yellow mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-gray-300">Location Restrictions</h4>
              <p className="text-xs text-gray-400 mt-1">
                Some exchanges like Binance restrict access from certain countries.
                If you're in a restricted region, you'll need to use a VPN to connect.
              </p>
              <a
                href="https://www.binance.com/en/support/faq/how-to-use-binance-if-it-is-blocked-in-my-country-360052857391"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neon-turquoise hover:underline mt-2 inline-block"
              >
                Learn more about using a VPN with exchanges
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
