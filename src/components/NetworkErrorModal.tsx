import React, { useState } from 'react';
import { WifiOff, ExternalLink, RefreshCw, Globe, Shield } from 'lucide-react';

interface NetworkErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  errorMessage?: string;
}

export function NetworkErrorModal({ 
  isOpen, 
  onClose, 
  onRetry,
  errorMessage = 'Network connection to exchange failed. Please check your internet connection or try using a VPN. If you\'re using Binance, ensure your location allows access to Binance API.'
}: NetworkErrorModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
      onClose();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const openVpnGuide = () => {
    window.open('https://www.binance.com/en/support/faq/how-to-use-binance-if-it-is-blocked-in-my-country-360052857391', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 rounded-full bg-neon-pink/10 flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-neon-pink" />
          </div>
          <h2 className="text-xl font-bold text-neon-pink mb-2">Network Connection Error</h2>
          <p className="text-gray-400 text-center mb-4">{errorMessage}</p>
        </div>

        <div className="space-y-4">
          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h3 className="text-md font-semibold text-gray-200 mb-2 flex items-center">
              <Globe className="w-4 h-4 mr-2" />
              Location Restrictions
            </h3>
            <p className="text-sm text-gray-400">
              Some exchanges like Binance restrict access from certain countries. 
              If you're in a restricted region, you'll need to use a VPN.
            </p>
          </div>

          <div className="bg-gunmetal-800 rounded-lg p-4">
            <h3 className="text-md font-semibold text-gray-200 mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              VPN Recommendation
            </h3>
            <p className="text-sm text-gray-400">
              Use a reliable VPN service to connect from a supported country.
              Make sure your VPN is active before retrying the connection.
            </p>
            <button
              onClick={openVpnGuide}
              className="mt-2 flex items-center text-neon-turquoise text-sm hover:underline"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Binance VPN Guide
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gunmetal-800 hover:bg-gunmetal-700 text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-4 py-2 bg-neon-turquoise/20 hover:bg-neon-turquoise/30 text-neon-turquoise rounded-lg flex items-center transition-colors"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Connection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
