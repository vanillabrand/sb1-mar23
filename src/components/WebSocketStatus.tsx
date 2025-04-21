import React, { useState, useEffect } from 'react';
import { websocketManager } from '../lib/websocket-manager';
import { eventBus } from '../lib/event-bus';

const WebSocketStatus: React.FC = () => {
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  useEffect(() => {
    // Load connections on mount
    loadConnections();

    // Set up refresh interval
    const interval = window.setInterval(() => {
      loadConnections();
    }, 5000); // Refresh every 5 seconds

    setRefreshInterval(interval);

    // Listen for WebSocket events
    const subscriptions = [
      eventBus.on('websocket:connected', () => loadConnections()),
      eventBus.on('websocket:disconnected', () => loadConnections()),
      eventBus.on('websocket:error', () => loadConnections()),
      eventBus.on('websocket:reconnecting', () => loadConnections()),
      eventBus.on('websocket:reconnectFailed', () => loadConnections())
    ];

    // Clean up
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

  const loadConnections = () => {
    const connectionIds = websocketManager.getConnections();
    const connectionStates: Record<string, any> = {};

    connectionIds.forEach(id => {
      const state = websocketManager.getState(id);
      if (state) {
        connectionStates[id] = state;
      }
    });

    setConnections(connectionStates);
  };

  const handleReconnect = (connectionId: string) => {
    websocketManager.reconnect(connectionId);
    loadConnections();
  };

  const handleClose = (connectionId: string) => {
    websocketManager.close(connectionId);
    loadConnections();
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">WebSocket Connections</h2>
        <div className="flex space-x-2">
          <button
            onClick={loadConnections}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {Object.keys(connections).length === 0 ? (
        <div className="text-center py-4 text-gray-400">No active WebSocket connections</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(connections).map(([connectionId, state]) => (
            <div key={connectionId} className="bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${state.isConnected ? 'bg-green-500' : state.isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium">{connectionId}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {state.isConnected ? 'Connected' : state.isConnecting ? 'Connecting...' : 'Disconnected'}
                    {state.reconnectAttempts > 0 && ` • ${state.reconnectAttempts} reconnect attempts`}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReconnect(connectionId)}
                    className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    disabled={state.isConnecting}
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={() => handleClose(connectionId)}
                    className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Last message: </span>
                    <span>{formatTime(state.lastMessageTime)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last heartbeat: </span>
                    <span>{formatTime(state.lastHeartbeatTime)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Subscriptions: </span>
                    <span>{state.subscriptions.size}</span>
                  </div>
                  {state.subscriptions.size > 0 && (
                    <div className="col-span-2 mt-2">
                      <div className="text-gray-400 mb-1">Active subscriptions:</div>
                      <div className="bg-gray-900 p-2 rounded max-h-32 overflow-y-auto text-xs">
                        {Array.from(state.subscriptions).map((sub: string) => (
                          <div key={sub} className="mb-1 truncate">{sub}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSocketStatus;
