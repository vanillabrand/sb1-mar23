import { Dialog } from '@headlessui/react';
import { AlertTriangle, X } from 'lucide-react';

interface RiskAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    symbol: string;
    riskLevel: string;
    currentPrice: number;
    entryPrice: number;
    size: number;
    pnl: number;
  };
}

export function RiskAlertModal({ isOpen, onClose, position }: RiskAlertModalProps) {
  const getPnlColor = () => {
    return position.pnl >= 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gunmetal-900 rounded-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-xl font-bold text-white flex items-center gap-3">
              <AlertTriangle className="text-neon-amber" />
              Risk Alert
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gunmetal-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-white mb-4">
                Position Details: {position.symbol}
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Level</span>
                  <span className="text-neon-amber">{position.riskLevel}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Price</span>
                  <span className="text-white">${position.currentPrice}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Entry Price</span>
                  <span className="text-white">${position.entryPrice}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Position Size</span>
                  <span className="text-white">{position.size}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">P&L</span>
                  <span className={getPnlColor()}>
                    {position.pnl >= 0 ? '+' : ''}{position.pnl}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Handle close position
                  onClose();
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition-colors"
              >
                Close Position
              </button>
              
              <button
                onClick={() => {
                  // Handle adjust stop loss
                  onClose();
                }}
                className="flex-1 bg-gunmetal-700 hover:bg-gunmetal-600 text-white py-2 rounded-lg transition-colors"
              >
                Adjust Stop Loss
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}