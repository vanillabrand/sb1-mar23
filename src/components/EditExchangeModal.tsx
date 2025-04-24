import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AlertCircle, RefreshCw, Info, Save, HelpCircle } from 'lucide-react';
import type { Exchange, ExchangeConfig } from '../lib/types';
import { exchangeConfigs } from './exchange-configs';

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
  const [formValues, setFormValues] = useState<Record<string, string>>({
    apiKey: '',
    secret: '',
    memo: ''
  });
  const [useTestnet, setUseTestnet] = useState(false);
  const [useUSDX, setUseUSDX] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the configuration for the selected exchange
  const exchangeConfig = exchange ?
    exchangeConfigs[exchange.name.toLowerCase()] || null : null;

  // Initialize form when exchange changes
  useEffect(() => {
    if (exchange) {
      // For security reasons, we don't show existing credentials
      // We just provide empty fields for the user to update
      setFormValues({
        apiKey: '',
        secret: '',
        memo: ''
      });
      setUseTestnet(exchange.testnet || false);
      setUseUSDX(exchange.use_usdx || false);
    }
  }, [exchange]);

  // Handle input changes
  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exchange) {
      setError('No exchange data provided');
      return;
    }

    // Check if any fields are filled - we only want to update fields that have been changed
    const hasChanges = Object.values(formValues).some(value => value.trim() !== '');

    if (!hasChanges) {
      setError('No changes detected. Please update at least one field.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Create a config object with only the fields that have been filled
      const config: ExchangeConfig = {
        name: exchange.name.toLowerCase(),
        apiKey: formValues.apiKey || '',
        secret: formValues.secret || '',
        memo: formValues.memo || '',
        testnet: useTestnet,
        useUSDX: useUSDX
      };

      await onSave(config, exchange.id);

      // Reset form
      setFormValues({
        apiKey: '',
        secret: '',
        memo: ''
      });
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
              value={exchangeConfig?.name || exchange?.name || ''}
              disabled
              className="bg-gunmetal-800/50"
            />
          </div>

          {/* Exchange description */}
          {exchangeConfig && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-300">{exchangeConfig.description}</p>
              <p className="text-xs text-gray-400 mt-1">Leave fields blank to keep existing values</p>
            </div>
          )}

          {/* Dynamic fields based on exchange configuration */}
          {exchangeConfig && exchangeConfig.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">
                {field.name}
              </label>
              <div className="relative">
                <Input
                  type={field.type}
                  value={formValues[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={`Enter new ${field.name.toLowerCase()} (leave blank to keep current)`}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-help">
                  <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300" title={field.description} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{field.description}</p>
            </div>
          ))}

          {/* Fallback fields if no exchange config is found */}
          {exchange && !exchangeConfig && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  API Key
                </label>
                <Input
                  type="text"
                  value={formValues.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="Enter new API key (leave blank to keep current)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  API Secret
                </label>
                <Input
                  type="password"
                  value={formValues.secret}
                  onChange={(e) => handleInputChange('secret', e.target.value)}
                  placeholder="Enter new API secret (leave blank to keep current)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Memo/Passphrase
                </label>
                <Input
                  type="text"
                  value={formValues.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  placeholder="Enter new memo or passphrase (leave blank to keep current)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Required for some exchanges like KuCoin
                </p>
              </div>
            </>
          )}

          {/* TestNet option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useTestnet"
              checked={useTestnet}
              onChange={(e) => setUseTestnet(e.target.checked)}
              disabled={exchangeConfig && !exchangeConfig.testnetSupported}
              className="rounded bg-gunmetal-800 border-gunmetal-700"
            />
            <label htmlFor="useTestnet" className="text-sm">
              Use TestNet
              {exchangeConfig && !exchangeConfig.testnetSupported && (
                <span className="text-gray-400 ml-2">(Not supported by {exchangeConfig.name})</span>
              )}
            </label>
            <div className="relative group ml-1">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gunmetal-800 rounded-md shadow-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                TestNet is a sandbox environment for testing without real funds. Not all exchanges support TestNet.
              </div>
            </div>
          </div>

          {/* USDX option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useUSDX"
              checked={useUSDX}
              onChange={(e) => setUseUSDX(e.target.checked)}
              className="rounded bg-gunmetal-800 border-gunmetal-700"
            />
            <label htmlFor="useUSDX" className="text-sm">
              Use USDX for trading
            </label>
            <div className="relative group ml-1">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gunmetal-800 rounded-md shadow-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                USDX is a stablecoin that can be used for trading on some exchanges. Enable this if you prefer to use USDX instead of USDT.
              </div>
            </div>
          </div>

          {/* Exchange-specific information */}
          {exchangeConfig && exchangeConfig.testnetSupported && useTestnet && exchangeConfig.testnetUrl && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-2 text-blue-400">
                <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium mb-1">{exchangeConfig.name} TestNet Information:</p>
                  <ul className="text-xs list-disc pl-4 space-y-1">
                    <li>You are connecting to the {exchangeConfig.name} TestNet environment</li>
                    <li>Create TestNet API keys at <a href={exchangeConfig.testnetUrl} target="_blank" rel="noopener noreferrer" className="underline">{exchangeConfig.testnetUrl}</a></li>
                    <li>TestNet is for testing only and does not use real funds</li>
                    {exchangeConfig.apiDocUrl && (
                      <li>API Documentation: <a href={exchangeConfig.apiDocUrl} target="_blank" rel="noopener noreferrer" className="underline">View Docs</a></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

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
