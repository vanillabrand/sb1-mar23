import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AlertCircle, RefreshCw, Info, Save } from 'lucide-react';
import type { Exchange, ExchangeConfig } from '../lib/types';

interface EditExchangeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ExchangeConfig, exchangeId: string) => Promise<void>;
  exchange: Exchange | null;
  isTesting: boolean;
}

export function EditExchangeModal({
  open,
  onClose,
  onSave,
  exchange,
  isTesting
}: EditExchangeModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [memo, setMemo] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when exchange changes
  useEffect(() => {
    if (exchange) {
      setApiKey(exchange.credentials?.apiKey || '');
      setSecret(exchange.credentials?.secret || '');
      setMemo(exchange.memo || '');
      setUseTestnet(exchange.testnet || false);
    }
  }, [exchange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exchange || !apiKey || !secret) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onSave({
        name: exchange.name.toLowerCase(),
        apiKey,
        secret,
        memo: memo || '',
        testnet: useTestnet,
        useUSDX: false
      }, exchange.id);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exchange');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-100">Edit Exchange</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Exchange
            </label>
            <Input
              type="text"
              value={exchange?.name || ''}
              disabled
              className="bg-gunmetal-800/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              API Key
            </label>
            <Input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="Enter your API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Secret
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              placeholder="Enter your API secret"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Memo/Passphrase (Optional)
            </label>
            <Input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Enter memo or passphrase if required"
            />
            <p className="text-xs text-gray-400 mt-1">
              Required for some exchanges like KuCoin
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useTestnet"
              checked={useTestnet}
              onChange={(e) => setUseTestnet(e.target.checked)}
              className="rounded bg-gunmetal-800 border-gunmetal-700"
            />
            <label htmlFor="useTestnet" className="text-sm">
              Use TestNet
            </label>
            <div className="relative group ml-1">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gunmetal-800 rounded-md shadow-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                TestNet is a sandbox environment for testing without real funds. Not all exchanges support TestNet.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isTesting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isTesting}
              className="bg-neon-turquoise text-gunmetal-950 hover:bg-neon-yellow"
            >
              {(isSubmitting || isTesting) ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {isTesting ? 'Testing Connection...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
