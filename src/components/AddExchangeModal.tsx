import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AlertCircle, RefreshCw, Info, HelpCircle } from 'lucide-react';
import type { ExchangeConfig } from '../lib/types';
import { exchangeConfigs } from './exchange-configs';

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
  const exchangeConfig = selectedExchange ?
    exchangeConfigs[selectedExchange.toLowerCase()] || null : null;

  // Reset form values when exchange changes
  useEffect(() => {
    // Initialize with default empty values
    const initialValues: Record<string, string> = {
      apiKey: '',
      secret: '',
      memo: ''
    };

    setFormValues(initialValues);

    // Reset testnet checkbox based on exchange support
    if (exchangeConfig) {
      setUseTestnet(exchangeConfig.testnetSupported ? false : false);
    }
  }, [selectedExchange]);

  // Handle input changes
  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedExchange) {
      setError('Please select an exchange');
      return;
    }

    // Validate required fields based on exchange configuration
    if (exchangeConfig) {
      const missingFields = exchangeConfig.fields
        .filter(field => field.required && !formValues[field.key])
        .map(field => field.name);

      if (missingFields.length > 0) {
        setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
        return;
      }
    } else {
      // Fallback validation if no config is found
      if (!formValues.apiKey || !formValues.secret) {
        setError('Please fill in all required fields');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onAdd({
        name: selectedExchange.toLowerCase(),
        apiKey: formValues.apiKey,
        secret: formValues.secret,
        memo: formValues.memo || '',
        testnet: useTestnet,
        useUSDX: useUSDX
      });

      // Reset form
      setSelectedExchange('');
      setFormValues({
        apiKey: '',
        secret: '',
        memo: ''
      });
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
              {supportedExchanges.map(exchange => {
                const config = exchangeConfigs[exchange.toLowerCase()];
                return (
                  <option key={exchange} value={exchange}>
                    {config ? config.name : exchange}
                  </option>
                );
              })}
            </Select>
          </div>

          {/* Exchange description */}
          {exchangeConfig && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-300">{exchangeConfig.description}</p>
            </div>
          )}

          {/* Dynamic fields based on selected exchange */}
          {exchangeConfig && exchangeConfig.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">
                {field.name}{field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <Input
                  type={field.type}
                  value={formValues[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-help">
                  <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300" aria-label={field.description} data-tooltip={field.description} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{field.description}</p>
            </div>
          ))}

          {/* Fallback fields if no exchange config is found */}
          {selectedExchange && !exchangeConfig && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  API Key <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formValues.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  required
                  placeholder="Enter your API key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  API Secret <span className="text-red-500">*</span>
                </label>
                <Input
                  type="password"
                  value={formValues.secret}
                  onChange={(e) => handleInputChange('secret', e.target.value)}
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
                  value={formValues.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  placeholder="Enter memo if required"
                />
              </div>
            </>
          )}

          {/* TestNet option */}
          {selectedExchange && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useTestnet"
                checked={useTestnet}
                onChange={(e) => setUseTestnet(e.target.checked)}
                disabled={exchangeConfig && !exchangeConfig.testnetSupported ? true : undefined}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useTestnet" className="text-sm font-medium">
                Use TestNet (Recommended for testing)
                {exchangeConfig && !exchangeConfig.testnetSupported && (
                  <span className="text-gray-400 ml-2">(Not supported by {exchangeConfig.name})</span>
                )}
              </label>
            </div>
          )}

          {/* USDX option */}
          {selectedExchange && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useUSDX"
                checked={useUSDX}
                onChange={(e) => setUseUSDX(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useUSDX" className="text-sm font-medium">
                Use USDX for trading
              </label>
              <div className="relative group ml-1">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gunmetal-800 rounded-md shadow-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  USDX is a stablecoin that can be used for trading on some exchanges. Enable this if you prefer to use USDX instead of USDT.
                </div>
              </div>
            </div>
          )}

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
