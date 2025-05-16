import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { websocketService } from '../lib/websocket-service';
import { eventBus } from '../lib/event-bus';
import { Badge, Tooltip, Box, Text, HStack, Icon } from '@chakra-ui/react';
import { FiServer, FiWifi, FiWifiOff, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

/**
 * Component to display the status of API and WebSocket connections
 */
const ApiStatusIndicator: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
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
  
  // Determine colors and icons based on status
  const getStatusProps = (status: 'connected' | 'disconnected' | 'checking') => {
    switch (status) {
      case 'connected':
        return { 
          color: 'green', 
          icon: FiCheckCircle, 
          text: 'Connected' 
        };
      case 'disconnected':
        return { 
          color: 'red', 
          icon: FiAlertCircle, 
          text: 'Disconnected' 
        };
      case 'checking':
        return { 
          color: 'yellow', 
          icon: FiAlertCircle, 
          text: 'Checking...' 
        };
    }
  };
  
  const apiStatusProps = getStatusProps(apiStatus);
  const wsStatusProps = getStatusProps(wsStatus);
  
  return (
    <Tooltip 
      label={
        <Box p={2}>
          <Text fontWeight="bold" mb={2}>Connection Status</Text>
          <HStack mb={1}>
            <Icon as={FiServer} />
            <Text>API: {apiStatusProps.text}</Text>
            {latency !== null && apiStatus === 'connected' && (
              <Text fontSize="xs">({latency}ms)</Text>
            )}
          </HStack>
          <HStack>
            <Icon as={wsStatus === 'connected' ? FiWifi : FiWifiOff} />
            <Text>WebSocket: {wsStatusProps.text}</Text>
          </HStack>
        </Box>
      }
      placement="bottom-end"
      hasArrow
    >
      <HStack spacing={1} cursor="pointer">
        <Badge colorScheme={apiStatusProps.color} variant="subtle" p={1} borderRadius="md">
          <Icon as={FiServer} />
        </Badge>
        <Badge colorScheme={wsStatusProps.color} variant="subtle" p={1} borderRadius="md">
          <Icon as={wsStatus === 'connected' ? FiWifi : FiWifiOff} />
        </Badge>
      </HStack>
    </Tooltip>
  );
};

export default ApiStatusIndicator;
