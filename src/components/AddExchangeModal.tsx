import React, { useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AlertCircle } from 'lucide-react';
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
        testnet: false,
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
    <Dialog open={open} onClose={onClose}>
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
