import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Loader2,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { Trade } from '../types';
import { demoService } from '../lib/demo-service';
import { TradeFlowStage } from './TradeFlowStage';

interface TradeFlowDiagramProps {
  trade?: Trade;
  className?: string;
}

export function TradeFlowDiagram({ trade, className = '' }: TradeFlowDiagramProps) {
  const isDemoMode = demoService.isDemoMode();

  // Determine the current stage based on trade status
  const getCurrentStage = (): number => {
    if (!trade) return 0;

    switch (trade.status) {
      case 'pending':
        return 1;
      case 'open':
        return 2;
      case 'closed':
        return trade.profit && trade.profit > 0 ? 3 : 4;
      case 'failed':
        return 5;
      default:
        return 0;
    }
  };

  const currentStage = getCurrentStage();

  // Define stages
  const stages: StageProps[] = [
    {
      title: 'Strategy Analysis',
      description: 'The system analyzes market conditions and strategy parameters to identify potential trades.',
      icon: <Lightbulb className="w-6 h-6" />,
      status: currentStage > 0 ? 'completed' : 'current',
      isDemo: isDemoMode
    },
    {
      title: 'Trade Creation',
      description: 'A trade is created with entry price, position size, and risk parameters.',
      icon: <Clock className="w-6 h-6" />,
      status: currentStage === 1 ? 'current' : currentStage > 1 ? 'completed' : 'upcoming',
      isDemo: isDemoMode
    },
    {
      title: 'Active Trade',
      description: 'The trade is active in the market and being monitored for exit conditions.',
      icon: trade?.side === 'buy' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />,
      status: currentStage === 2 ? 'current' : currentStage > 2 ? 'completed' : 'upcoming',
      isDemo: isDemoMode
    },
    {
      title: 'Profitable Exit',
      description: 'The trade closed with a profit when exit conditions were met.',
      icon: <CheckCircle2 className="w-6 h-6" />,
      status: currentStage === 3 ? 'current' : currentStage > 3 ? 'completed' : 'upcoming',
      isDemo: isDemoMode
    },
    {
      title: 'Loss Exit',
      description: 'The trade closed with a loss when stop loss or other exit conditions were met.',
      icon: <X className="w-6 h-6" />,
      status: currentStage === 4 ? 'current' : currentStage > 4 ? 'completed' : 'upcoming',
      isDemo: isDemoMode
    },
    {
      title: 'Failed Trade',
      description: 'The trade failed to execute due to an error or insufficient funds.',
      icon: <AlertCircle className="w-6 h-6" />,
      status: currentStage === 5 ? 'current' : 'upcoming',
      isDemo: isDemoMode
    }
  ];

  // Filter stages based on trade status
  const filteredStages = stages.filter((stage, index) => {
    // Always show first two stages
    if (index < 2) return true;

    // For active trade stage
    if (index === 2) return true;

    // For profitable exit
    if (index === 3) return currentStage !== 4 && currentStage !== 5;

    // For loss exit
    if (index === 4) return currentStage !== 3 && currentStage !== 5;

    // For failed trade
    if (index === 5) return currentStage === 5;

    return false;
  });

  return (
    <div className={`bg-gunmetal-900/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Trade Flow</h3>
        <button className="text-gray-400 hover:text-white">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gunmetal-700" />

        {/* Stages */}
        <div className="flex justify-between relative z-10">
          {filteredStages.map((stage, index) => (
            <React.Fragment key={index}>
              <TradeFlowStage {...stage} />
              {index < filteredStages.length - 1 && (
                <div className="flex items-center justify-center mt-6">
                  <ArrowRight className="w-4 h-4 text-gunmetal-600" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Trade details */}
      {trade ? (
        <div className="mt-6 pt-4 border-t border-gunmetal-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Symbol</p>
              <p className="text-white font-medium">{trade.symbol}</p>
            </div>
            <div>
              <p className="text-gray-400">Side</p>
              <p className={`font-medium ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {trade.side === 'buy' ? 'Buy' : 'Sell'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Entry Price</p>
              <p className="text-white font-medium">
                ${trade.entryPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Status</p>
              <p className={`font-medium ${
                trade.status === 'open' ? 'text-blue-400' :
                trade.status === 'closed' && trade.profit && trade.profit > 0 ? 'text-green-400' :
                trade.status === 'closed' ? 'text-red-400' :
                trade.status === 'pending' ? 'text-yellow-400' :
                'text-gray-400'
              }`}>
                {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-4 border-t border-gunmetal-800 flex justify-center">
          <p className="text-gray-400 text-sm">Select a trade to view details</p>
        </div>
      )}
    </div>
  );
}
