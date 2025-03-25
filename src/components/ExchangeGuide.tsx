import React, { useState } from 'react';
import { Key, Lock, ArrowRight, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { SUPPORTED_EXCHANGES } from '../lib/types';

interface ExchangeGuideProps {
  exchangeId: string;
}

export function ExchangeGuide({ exchangeId }: ExchangeGuideProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const exchange = SUPPORTED_EXCHANGES.find(e => e.id === exchangeId);

  if (!exchange) {
    return (
      <div className="bg-gunmetal-900/95 backdrop-blur-xl rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4 text-neon-pink">
          <AlertCircle className="w-6 h-6" />
          <h2 className="text-xl font-bold">Exchange Not Found</h2>
        </div>
        <p className="text-gray-400">
          The selected exchange configuration could not be found.
        </p>
      </div>
    );
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="bg-gunmetal-900/95 backdrop-blur-xl rounded-xl p-5">
      <h2 className="text-xl font-bold gradient-text mb-4">Connect {exchange.name}</h2>
      <p className="text-gray-400 mb-6">
        Follow these steps to connect your {exchange.name} account and start trading.
      </p>

      <div className="space-y-6">
        {/* Setup Steps */}
        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Setup Instructions</h3>
          <div className="space-y-4">
            {exchange.docs.setup.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gunmetal-800/50 flex items-center justify-center">
                  {index === 0 ? (
                    <Key className="w-5 h-5 text-neon-turquoise" />
                  ) : index === exchange.docs.setup.length - 1 ? (
                    <ArrowRight className="w-5 h-5 text-neon-orange" />
                  ) : (
                    <Lock className="w-5 h-5 text-neon-yellow" />
                  )}
                </div>
                <div>
                  <p className="text-gray-300">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Permissions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Required Permissions</h3>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="space-y-2">
              {exchange.docs.permissions.map((permission, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gunmetal-800/50 rounded">
                  <span className="text-gray-300">{permission}</span>
                  <div className="w-6 h-6 rounded-full bg-neon-turquoise/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-neon-turquoise" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Note: Enable only the permissions listed above for security.
            </p>
          </div>
        </div>

        {/* Security Recommendations */}
        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Security Recommendations</h3>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="space-y-2">
              {exchange.docs.restrictions.map((restriction, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gunmetal-800/50 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-yellow"></div>
                  <span className="text-gray-300">{restriction}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* IP Restrictions */}
        <div className="bg-gunmetal-800/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">IP Restrictions</h3>
          <p className="text-gray-400 mb-3">
            For added security, you can restrict API access to specific IP addresses.
          </p>
          <div className="flex items-center justify-between p-3 bg-gunmetal-800/50 rounded">
            <span className="text-sm text-gray-300 font-mono">0.0.0.0/0</span>
            <button 
              onClick={() => handleCopy("0.0.0.0/0", "ip")}
              className="text-gray-400 hover:text-neon-turquoise transition-colors"
              title="Copy"
            >
              {copiedField === "ip" ? (
                <CheckCircle2 className="w-4 h-4 text-neon-turquoise" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use "0.0.0.0/0" to allow access from any IP address, or specify your IP for enhanced security.
          </p>
        </div>
      </div>
    </div>
  );
}