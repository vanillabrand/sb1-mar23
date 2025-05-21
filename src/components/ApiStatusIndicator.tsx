import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { websocketService } from '../lib/websocket-service';
import { eventBus } from '../lib/event-bus';
import { Server, Wifi, WifiOff } from 'lucide-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface StatusProps {
  color: string;
  text: string;
}

/**
 * Component to display the status of API and WebSocket connections
 */
const ApiStatusIndicator = () => {
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>('checking');
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    // Check API status
    const checkApiStatus = async () => {
      try {
        const startTime = Date.now();
        const health = await apiClient.checkHealth();
        const endTime = Date.now();

        if (health.status === 'ok') {
          setApiStatus('connected');
          setLatency(endTime - startTime);
        } else {
          setApiStatus('disconnected');
        }
      } catch (error) {
        setApiStatus('disconnected');
      }
    };

    // Initial check
    checkApiStatus();

    // Set up periodic check
    const apiCheckInterval = setInterval(checkApiStatus, 30000); // Check every 30 seconds

    // Listen for WebSocket connection events
    const handleWsConnected = () => {
      setWsStatus('connected');
    };

    const handleWsDisconnected = () => {
      setWsStatus('disconnected');
    };

    // Check current WebSocket status
    if (websocketService.getConnectionStatus()) {
      setWsStatus('connected');
    } else {
      setWsStatus('disconnected');
    }

    // Subscribe to WebSocket events
    eventBus.on('websocket:connected', handleWsConnected);
    eventBus.on('websocket:disconnected', handleWsDisconnected);

    // Clean up
    return () => {
      clearInterval(apiCheckInterval);
      eventBus.off('websocket:connected', handleWsConnected);
      eventBus.off('websocket:disconnected', handleWsDisconnected);
    };
  }, []);

  // Determine colors based on status
  const getStatusProps = (status: ConnectionStatus): StatusProps => {
    switch (status) {
      case 'connected':
        return {
          color: 'green',
          text: 'Connected'
        };
      case 'disconnected':
        return {
          color: 'red',
          text: 'Disconnected'
        };
      case 'checking':
      default:
        return {
          color: 'yellow',
          text: 'Checking...'
        };
    }
  };

  const apiStatusProps = getStatusProps(apiStatus);
  const wsStatusProps = getStatusProps(wsStatus);

  return (
    <div className="relative group">
      <div className="flex items-center space-x-1 cursor-pointer">
        <div className={`p-1 rounded-md ${apiStatus === 'connected' ? 'bg-green-500/20 text-green-500' : apiStatus === 'disconnected' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
          <Server className="w-4 h-4" />
        </div>
        <div className={`p-1 rounded-md ${wsStatus === 'connected' ? 'bg-green-500/20 text-green-500' : wsStatus === 'disconnected' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
          {wsStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </div>
      </div>

      {/* Tooltip */}
      <div className="absolute z-50 hidden group-hover:block bottom-full right-0 mb-2 w-48 bg-gunmetal-800 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-bold mb-2 text-white">Connection Status</div>
        <div className="flex items-center mb-1">
          <Server className="w-4 h-4 mr-2" />
          <span>API: {apiStatusProps.text}</span>
          {latency !== null && apiStatus === 'connected' && (
            <span className="text-xs ml-1">({latency}ms)</span>
          )}
        </div>
        <div className="flex items-center">
          {wsStatus === 'connected' ? <Wifi className="w-4 h-4 mr-2" /> : <WifiOff className="w-4 h-4 mr-2" />}
          <span>WebSocket: {wsStatusProps.text}</span>
        </div>
        <div className="absolute w-2 h-2 bg-gunmetal-800 transform rotate-45 right-2 -bottom-1"></div>
      </div>
    </div>
  );
};

export default ApiStatusIndicator;
