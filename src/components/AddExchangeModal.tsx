import React, { useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AlertCircle, RefreshCw, Info } from 'lucide-react';
import type { ExchangeConfig } from '../lib/types';

interface AddExchangeModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (config: ExchangeConfig) => Promise<void>;
  isTesting: boolean;
  supportedExchanges: string[];
}

export function AddExchangeModal({
  open,
  onClose,
  onAdd,
  isTesting,
  supportedExchanges
}: AddExchangeModalProps) {
  const [selectedExchange, setSelectedExchange] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [memo, setMemo] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedExchange || !apiKey || !secret) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onAdd({
        name: selectedExchange.toLowerCase(), // Convert to lowercase here
        apiKey,
        secret,
        memo: memo || '',
        testnet: useTestnet,
        useUSDX: false
      });

      // Reset form
      setSelectedExchange('');
      setApiKey('');
      setSecret('');
      setMemo('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exchange');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-100">Add Exchange</h2>

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
            <Select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              required
            >
              <option value="">Select an exchange</option>
              {supportedExchanges.map(exchange => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </Select>
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
              API Secret
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
              Memo (Optional)
            </label>
            <Input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Enter memo if required"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useTestnet"
              checked={useTestnet}
              onChange={(e) => setUseTestnet(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="useTestnet" className="text-sm font-medium">
              Use TestNet (Recommended for testing)
            </label>
          </div>

          {selectedExchange === 'binance' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-2 text-blue-400">
                <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium mb-1">Binance API Key Requirements:</p>
                  <ul className="text-xs list-disc pl-4 space-y-1">
                    <li>Create API keys from your Binance account settings</li>
                    <li>Enable at minimum "Read-Only" permissions</li>
                    <li>If using TestNet, create keys at <a href="https://testnet.binance.vision/" target="_blank" rel="noopener noreferrer" className="underline">testnet.binance.vision</a></li>
                    <li>Some regions may require a VPN to access Binance API</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isTesting}
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : isSubmitting ? (
                'Adding Exchange...'
              ) : (
                'Add Exchange'
              )}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
