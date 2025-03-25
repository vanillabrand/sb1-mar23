import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';

interface ConnectionStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message?: string;
}

interface ConnectionStatusProps {
  onClose?: () => void;
}

export function ConnectionStatus({ onClose }: ConnectionStatusProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [steps, setSteps] = useState<ConnectionStep[]>([
    { id: 'exchange', name: 'Exchange Connection', status: 'pending' },
    { id: 'websocket', name: 'WebSocket Connection', status: 'pending' },
    { id: 'market', name: 'Market Data', status: 'pending' }
  ]);
  const [overallStatus, setOverallStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeouts: NodeJS.Timeout[] = [];
    
    const initializeConnection = async () => {
      try {
        // Initialize Exchange with timeout
        updateStep('exchange', 'loading', 'Connecting to exchange...');
        const exchangeTimeout = setTimeout(() => {
          if (mounted) {
            updateStep('exchange', 'error', 'Connection timeout');
            setOverallStatus('error');
          }
        }, 10000); // 10 second timeout
        timeouts.push(exchangeTimeout);

        try {
          await exchangeService.ensureInitialized();
          if (mounted) {
            clearTimeout(exchangeTimeout);
            updateStep('exchange', 'completed', 'Exchange connected successfully');
          }
        } catch (error) {
          if (mounted) {
            clearTimeout(exchangeTimeout);
            throw error;
          }
        }

        if (!mounted) return;

        // Initialize WebSocket with timeout
        updateStep('websocket', 'loading', 'Establishing WebSocket connection...');
        const wsTimeout = setTimeout(() => {
          if (mounted) {
            updateStep('websocket', 'error', 'WebSocket connection timeout');
            setOverallStatus('error');
          }
        }, 5000); // 5 second timeout
        timeouts.push(wsTimeout);

        try {
          const wsConnected = await Promise.race([
            new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500)),
            new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout')), 5000))
          ]);
          
          if (mounted) {
            clearTimeout(wsTimeout);
            if (wsConnected) {
              updateStep('websocket', 'completed', 'WebSocket connected successfully');
            } else {
              throw new Error('WebSocket connection failed');
            }
          }
        } catch (error) {
          if (mounted) {
            clearTimeout(wsTimeout);
            throw error;
          }
        }

        if (!mounted) return;

        // Initialize Market Data with timeout
        updateStep('market', 'loading', 'Loading market data...');
        const marketTimeout = setTimeout(() => {
          if (mounted) {
            updateStep('market', 'error', 'Market data timeout');
            setOverallStatus('error');
          }
        }, 5000); // 5 second timeout
        timeouts.push(marketTimeout);

        try {
          await Promise.race([
            new Promise(resolve => setTimeout(resolve, 1000)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Market data timeout')), 5000))
          ]);
          
          if (mounted) {
            clearTimeout(marketTimeout);
            updateStep('market', 'completed', 'Market data loaded successfully');
            setOverallStatus('connected');
            startLatencyChecks();

            // Auto-contract panel after 2 seconds on successful connection
            setTimeout(() => {
              if (mounted) {
                setIsExpanded(false);
                onClose?.(); // Notify parent component that panel is closed
              }
            }, 2000);
          }
        } catch (error) {
          if (mounted) {
            clearTimeout(marketTimeout);
            throw error;
          }
        }
      } catch (error) {
        if (mounted) {
          logService.log('error', 'Connection initialization failed', error, 'ConnectionStatus');
          setOverallStatus('error');
          const errorMessage = error instanceof Error ? error.message : 'Connection failed';
          
          // Update the current step with error
          const currentStep = steps.find(s => s.status === 'loading');
          if (currentStep) {
            updateStep(currentStep.id, 'error', errorMessage);
          }
        }
      }
    };

    initializeConnection();

    // Cleanup function
    return () => {
      mounted = false;
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [onClose]);

  const updateStep = (id: string, status: ConnectionStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, status, message } : step
    ));
  };

  const startLatencyChecks = () => {
    const checkLatency = async () => {
      try {
        const start = performance.now();
        const health = await exchangeService.checkHealth();
        const end = performance.now();
        
        if (health.ok) {
          setLatency(Math.round(end - start));
          setOverallStatus('connected');
        } else {
          setOverallStatus('error');
          setLatency(null);
        }
      } catch (error) {
        setOverallStatus('error');
        setLatency(null);
      }
    };

    // Initial check
    checkLatency();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkLatency, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  };

  const getStepIcon = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full bg-gunmetal-700" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-neon-yellow animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-neon-turquoise" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-neon-pink" />;
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'connected':
        return 'text-neon-turquoise';
      case 'connecting':
        return 'text-neon-yellow';
      case 'error':
        return 'text-neon-pink';
    }
  };

  const getStatusBg = () => {
    switch (overallStatus) {
      case 'connected':
        return 'bg-neon-turquoise/10';
      case 'connecting':
        return 'bg-neon-yellow/10';
      case 'error':
        return 'bg-neon-pink/10';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusBg()} transition-colors`}
      >
        <div className="flex items-center gap-2">
          {overallStatus === 'connecting' ? (
            <Loader2 className={`w-4 h-4 animate-spin ${getStatusColor()}`} />
          ) : overallStatus === 'connected' ? (
            <Wifi className={`w-4 h-4 ${getStatusColor()}`} />
          ) : (
            <WifiOff className={`w-4 h-4 ${getStatusColor()}`} />
          )}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {overallStatus === 'connecting' ? 'Connecting' :
             overallStatus === 'connected' ? 'Connected' : 
             'Connection Error'}
          </span>
        </div>
        {latency !== null && overallStatus === 'connected' && (
          <span className="text-sm font-mono text-gray-400">{latency}ms</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-gunmetal-900/95 backdrop-blur-xl rounded-lg border border-gunmetal-800 p-4 space-y-4 z-10"
          >
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {index !== 0 && (
                  <div 
                    className={`absolute left-[11px] -top-4 h-4 w-0.5 ${
                      step.status === 'completed' ? 'bg-neon-turquoise/50' :
                      step.status === 'error' ? 'bg-neon-pink/50' :
                      'bg-gunmetal-700'
                    }`} 
                  />
                )}
                <div className="flex items-start gap-3">
                  {getStepIcon(step.status)}
                  <div>
                    <p className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-neon-turquoise' :
                      step.status === 'error' ? 'text-neon-pink' :
                      step.status === 'loading' ? 'text-neon-yellow' :
                      'text-gray-400'
                    }`}>
                      {step.name}
                    </p>
                    {step.message && (
                      <p className="text-xs text-gray-400 mt-0.5">{step.message}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {overallStatus === 'error' && (
              <div className="flex items-center gap-2 p-2 rounded bg-neon-pink/10 text-neon-pink text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Connection failed. Please check your settings and try again.</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}