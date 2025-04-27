import React from 'react';
import { History, ChevronRight, X } from 'lucide-react';
import type { Strategy } from '../lib/supabase-types';

interface BacktestOfferProps {
  strategy: Strategy;
  onAccept: () => void;
  onDecline: () => void;
}

export function BacktestOffer({ strategy, onAccept, onDecline }: BacktestOfferProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-6 h-6 text-neon-orange" />
          <h2 className="text-xl font-bold">Backtest Your Strategy</h2>
        </div>

        <p className="text-gray-300 mb-6">
          Would you like to backtest <span className="text-neon-turquoise font-semibold">{(strategy as any).title || strategy.name}</span> before
          deploying it? This will help you understand how your strategy would have performed
          historically and optimize its parameters.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Skip for Now
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-2 px-4 py-2 bg-neon-orange text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
          >
            Run Backtest
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}