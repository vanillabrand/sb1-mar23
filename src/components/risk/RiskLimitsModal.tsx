import { Dialog } from '@headlessui/react';
import { Settings2, X } from 'lucide-react';

interface RiskLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  limits: {
    maxDrawdown: number;
    maxLeverage: number;
    maxPositionSize: number;
    stopLossPercentage: number;
  };
  onSave: (newLimits: typeof limits) => void;
}

export function RiskLimitsModal({ isOpen, onClose, limits, onSave }: RiskLimitsModalProps) {
  const [formData, setFormData] = useState(limits);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gunmetal-900 rounded-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-xl font-bold text-white flex items-center gap-3">
              <Settings2 className="text-neon-turquoise" />
              Risk Limits
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Maximum Drawdown (%)
                </label>
                <input
                  type="number"
                  value={formData.maxDrawdown}
                  onChange={(e) => setFormData({
                    ...formData,
                    maxDrawdown: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-turquoise"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Maximum Leverage
                </label>
                <input
                  type="number"
                  value={formData.maxLeverage}
                  onChange={(e) => setFormData({
                    ...formData,
                    maxLeverage: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-turquoise"
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Maximum Position Size (%)
                </label>
                <input
                  type="number"
                  value={formData.maxPositionSize}
                  onChange={(e) => setFormData({
                    ...formData,
                    maxPositionSize: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-turquoise"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Stop Loss Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.stopLossPercentage}
                  onChange={(e) => setFormData({
                    ...formData,
                    stopLossPercentage: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-turquoise"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gunmetal-700 hover:bg-gunmetal-600 text-white py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-neon-turquoise hover:bg-opacity-90 text-gunmetal-900 py-2 rounded-lg transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}