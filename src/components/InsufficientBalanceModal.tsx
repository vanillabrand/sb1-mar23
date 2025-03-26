import React from 'react';
import { ExternalLink, AlertCircle, Wallet } from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';

interface InsufficientBalanceModalProps {
  marketType: 'spot' | 'margin' | 'futures';
  onClose: () => void;
}

export function InsufficientBalanceModal({ marketType, onClose }: InsufficientBalanceModalProps) {
  const handleExchangeLink = () => {
    const exchangeUrl = exchangeService.getExchangeDepositUrl();
    window.open(exchangeUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-6 h-6 text-neon-turquoise" />
          <h2 className="text-xl font-bold gradient-text">Insufficient Balance</h2>
        </div>

        <div className="mb-6 p-4 bg-gunmetal-800/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-neon-orange mt-0.5" />
          <div>
            <p className="text-gray-300">
              {exchangeService.isDemo() 
                ? "Your demo account balance is too low for trading. This is a simulation message."
                : `Your ${marketType} wallet balance is below the minimum required amount for trading. Please deposit additional funds to continue trading operations.`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          {!exchangeService.isDemo() && (
            <button
              onClick={handleExchangeLink}
              className="w-full bg-neon-turquoise/10 hover:bg-neon-turquoise/20 border border-neon-turquoise/20 text-neon-turquoise py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Deposit Funds
            </button>
          )}
          
          <button
            onClick={onClose}
            className="w-full bg-gunmetal-800 hover:bg-gunmetal-700 text-gray-300 py-2.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
