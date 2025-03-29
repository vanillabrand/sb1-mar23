import React from 'react';
import { Exchange } from '../lib/types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface ExchangeCardProps {
  exchange: Exchange;
  isDefault: boolean;
  onRemove: () => void;
  onSetDefault: () => void;
  onTest: () => Promise<boolean>;
}

export function ExchangeCard({ 
  exchange, 
  isDefault,
  onRemove, 
  onSetDefault,
  onTest 
}: ExchangeCardProps) {
  const [testing, setTesting] = React.useState(false);

  const handleTest = async () => {
    setTesting(true);
    const success = await onTest();
    setTesting(false);
    
    if (success) {
      // Show success toast or feedback
    }
  };

  return (
    <div className="bg-gunmetal-800 rounded-lg p-4 border border-gunmetal-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img 
            src={exchange.logo} 
            alt={exchange.name} 
            className="w-8 h-8"
          />
          <div>
            <h3 className="font-medium">{exchange.name}</h3>
            {isDefault && (
              <Badge variant="success" className="mt-1">
                Default Exchange
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-400">{exchange.description}</p>
        <div className="flex flex-wrap gap-2">
          {exchange.features.map(feature => (
            <Badge key={feature} variant="secondary">
              {feature}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        
        {!isDefault && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSetDefault}
          >
            Set as Default
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}