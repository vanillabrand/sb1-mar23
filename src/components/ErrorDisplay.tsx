import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  AlertTriangle, 
  Ban, 
  ChevronDown, 
  ExternalLink, 
  RefreshCw, 
  WifiOff, 
  X 
} from 'lucide-react';

export type ErrorCategory = 
  | 'network' 
  | 'validation' 
  | 'exchange' 
  | 'authentication' 
  | 'permission' 
  | 'timeout' 
  | 'insufficient_funds' 
  | 'unknown';

export interface ErrorDisplayProps {
  message: string;
  category?: ErrorCategory;
  details?: string;
  onRetry?: () => void;
  onClose?: () => void;
  className?: string;
  showIcon?: boolean;
  showDetails?: boolean;
  showRetry?: boolean;
  showClose?: boolean;
  compact?: boolean;
}

export function ErrorDisplay({ 
  message, 
  category = 'unknown', 
  details,
  onRetry,
  onClose,
  className = '',
  showIcon = true,
  showDetails = false,
  showRetry = false,
  showClose = false,
  compact = false
}: ErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get icon and color based on category
  const getIconAndColor = () => {
    switch (category) {
      case 'network':
        return { 
          icon: <WifiOff className="w-5 h-5" />, 
          color: 'text-neon-pink',
          bgColor: 'bg-neon-pink/10',
          borderColor: 'border-neon-pink/30'
        };
      case 'validation':
        return { 
          icon: <AlertCircle className="w-5 h-5" />, 
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/10',
          borderColor: 'border-yellow-400/30'
        };
      case 'exchange':
        return { 
          icon: <Ban className="w-5 h-5" />, 
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          borderColor: 'border-red-400/30'
        };
      case 'authentication':
        return { 
          icon: <AlertTriangle className="w-5 h-5" />, 
          color: 'text-orange-400',
          bgColor: 'bg-orange-400/10',
          borderColor: 'border-orange-400/30'
        };
      case 'permission':
        return { 
          icon: <Ban className="w-5 h-5" />, 
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          borderColor: 'border-red-400/30'
        };
      case 'timeout':
        return { 
          icon: <AlertCircle className="w-5 h-5" />, 
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10',
          borderColor: 'border-blue-400/30'
        };
      case 'insufficient_funds':
        return { 
          icon: <AlertTriangle className="w-5 h-5" />, 
          color: 'text-orange-400',
          bgColor: 'bg-orange-400/10',
          borderColor: 'border-orange-400/30'
        };
      default:
        return { 
          icon: <AlertCircle className="w-5 h-5" />, 
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          borderColor: 'border-red-400/30'
        };
    }
  };
  
  const { icon, color, bgColor, borderColor } = getIconAndColor();
  
  // Get help text based on category
  const getHelpText = () => {
    switch (category) {
      case 'network':
        return 'Check your internet connection or try using a VPN. If you\'re using Binance, ensure your location allows access to Binance API.';
      case 'validation':
        return 'Please check your input values and try again.';
      case 'exchange':
        return 'There was an issue with the exchange. This could be due to maintenance or temporary API issues.';
      case 'authentication':
        return 'Your session may have expired. Try logging out and logging back in.';
      case 'permission':
        return 'You don\'t have permission to perform this action. Contact support if you believe this is an error.';
      case 'timeout':
        return 'The operation timed out. This could be due to network issues or high server load.';
      case 'insufficient_funds':
        return 'You don\'t have enough funds to complete this operation. Add funds or reduce the amount.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
  };
  
  // Get suggested actions based on category
  const getSuggestedActions = () => {
    switch (category) {
      case 'network':
        return [
          { label: 'Use VPN', url: 'https://www.binance.com/en/support/faq/how-to-use-binance-if-it-is-blocked-in-my-country-360052857391' },
          { label: 'Check Status', url: 'https://www.binance.com/en/support' }
        ];
      case 'exchange':
        return [
          { label: 'Exchange Status', url: 'https://www.binance.com/en/support' }
        ];
      case 'authentication':
        return [
          { label: 'Log Out', action: () => window.location.href = '/logout' }
        ];
      default:
        return [];
    }
  };
  
  const suggestedActions = getSuggestedActions();
  
  // Compact version
  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 ${bgColor} ${borderColor} border rounded-md ${className}`}>
        {showIcon && <span className={color}>{icon}</span>}
        <span className={`text-sm ${color}`}>{message}</span>
        {showRetry && onRetry && (
          <button onClick={onRetry} className="ml-auto">
            <RefreshCw className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
        {showClose && onClose && (
          <button onClick={onClose} className="ml-auto">
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
    );
  }
  
  // Full version
  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg overflow-hidden ${className}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {showIcon && <span className={color}>{icon}</span>}
          <div className="flex-1">
            <h4 className={`font-medium ${color}`}>{message}</h4>
            <p className="text-sm text-gray-400 mt-1">{getHelpText()}</p>
            
            {/* Action buttons */}
            {suggestedActions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {suggestedActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => action.url ? window.open(action.url, '_blank') : action.action?.()}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-gunmetal-800 text-gray-300 rounded-md hover:bg-gunmetal-700 transition-colors"
                  >
                    {action.url ? <ExternalLink className="w-3 h-3" /> : null}
                    {action.label}
                  </button>
                ))}
                
                {showRetry && onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-gunmetal-800 text-gray-300 rounded-md hover:bg-gunmetal-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            )}
            
            {/* Details toggle */}
            {showDetails && details && (
              <div className="mt-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  {isExpanded ? 'Hide Details' : 'Show Details'}
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <pre className="mt-2 p-2 bg-gunmetal-900 rounded text-xs text-gray-400 overflow-x-auto">
                        {details}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          
          {showClose && onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
