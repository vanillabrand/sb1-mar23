import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LeverageDial } from './LeverageDial';
import { StrategyParameterEditor } from './StrategyParameterEditor';
import { bitmartService } from '../lib/bitmart-service';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Strategy } from '../lib/supabase-types';

interface StrategyEditorProps {
  strategy: Strategy;
  onSave: (updates: any) => Promise<void>;
  isEditing: boolean;
  onClose?: () => void;
}

interface AssetData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export function StrategyEditor({ strategy, onSave, isEditing, onClose }: StrategyEditorProps) {
  const [config, setConfig] = useState(strategy.strategy_config);
  const [isSaving, setIsSaving] = useState(false);
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const initialConfigRef = useRef(strategy.strategy_config);

  useEffect(() => {
    if (!isEditing && config?.assets) {
      // Subscribe to WebSocket updates for strategy assets only
      config.assets.forEach(symbol => {
        bitmartService.subscribeToSymbol(symbol);
      });

      // Initial data fetch for strategy assets only
      const fetchInitialData = async () => {
        try {
          const assetPromises = config.assets.map(async (symbol: string) => {
            const ticker = await bitmartService.getTicker(symbol);
            const price = parseFloat(ticker.last_price);
            const open24h = parseFloat(ticker.open_24h);
            const change24h = ((price - open24h) / open24h) * 100;

            return {
              symbol,
              price,
              change24h,
              volume24h: parseFloat(ticker.quote_volume_24h),
              high24h: parseFloat(ticker.high_24h),
              low24h: parseFloat(ticker.low_24h)
            };
          });

          const data = await Promise.all(assetPromises);
          setAssetData(data);
        } catch (error) {
          console.error('Error fetching initial asset data:', error);
        }
      };

      fetchInitialData();

      // Set up WebSocket update handler
      const handlePriceUpdate = (data: { 
        symbol: string; 
        price: number; 
        change24h: number; 
        volume24h: number;
        high24h: number;
        low24h: number;
      }) => {
        // Only update data for assets in this strategy
        if (config.assets.includes(data.symbol)) {
          setAssetData(prev => {
            const index = prev.findIndex(asset => asset.symbol === data.symbol);
            if (index === -1) {
              return [...prev, data];
            }
            const updated = [...prev];
            updated[index] = data;
            return updated;
          });
        }
      };

      bitmartService.on('priceUpdate', handlePriceUpdate);

      // Cleanup subscriptions
      return () => {
        config.assets.forEach(symbol => {
          bitmartService.unsubscribeFromSymbol(symbol);
        });
        bitmartService.off('priceUpdate', handlePriceUpdate);
      };
    }
  }, [config?.assets, isEditing]);

  const handleParameterChange = (section: string, param: string, value: number) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [param]: value
      }
    }));
    setHasChanges(true);
  };

  const handleLeverageChange = (value: number) => {
    setConfig((prev: any) => ({
      ...prev,
      trade_parameters: {
        ...prev.trade_parameters,
        leverage: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave({ strategy_config: config });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose?.();
      }
    } else {
      onClose?.();
    }
  };

  // Handle click outside
  const containerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (onClose) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [hasChanges]);

  if (!config) return null;

  return (
    <div ref={containerRef} className="space-y-6">
      {isEditing ? (
        <>
          {/* Trading Parameters */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Trading Parameters</h4>
            <div className="grid grid-cols-1 gap-6">
              {/* Leverage Control */}
              <div className="bg-gunmetal-900/30 backdrop-blur-xl p-6 rounded-lg">
                <LeverageDial
                  value={Math.round(config.trade_parameters.leverage)}
                  onChange={handleLeverageChange}
                  min={1}
                  max={100}
                />
              </div>

              {/* Other Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StrategyParameterEditor
                  parameter={{
                    name: 'Position Size',
                    value: Math.round(config.trade_parameters.position_size * 10000) / 100,
                    min: 1,
                    max: 100,
                    step: 1,
                    unit: '%'
                  }}
                  onChange={(value) => handleParameterChange('trade_parameters', 'position_size', value / 100)}
                  isEditing={true}
                />
                <StrategyParameterEditor
                  parameter={{
                    name: 'Confidence',
                    value: Math.round(config.trade_parameters.confidence_factor * 100),
                    min: 10,
                    max: 100,
                    step: 1,
                    unit: '%'
                  }}
                  onChange={(value) => handleParameterChange('trade_parameters', 'confidence_factor', value / 100)}
                  isEditing={true}
                />
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Risk Management</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StrategyParameterEditor
                parameter={{
                  name: 'Stop Loss',
                  value: Math.round(config.risk_management.stop_loss * 100) / 100,
                  min: 0.5,
                  max: 10,
                  step: 0.1,
                  unit: '%',
                  color: 'red'
                }}
                onChange={(value) => handleParameterChange('risk_management', 'stop_loss', value)}
                isEditing={true}
              />
              <StrategyParameterEditor
                parameter={{
                  name: 'Take Profit',
                  value: Math.round(config.risk_management.take_profit * 100) / 100,
                  min: 1,
                  max: 20,
                  step: 0.1,
                  unit: '%',
                  color: 'green'
                }}
                onChange={(value) => handleParameterChange('risk_management', 'take_profit', value)}
                isEditing={true}
              />
              <StrategyParameterEditor
                parameter={{
                  name: 'Trailing Stop',
                  value: Math.round(config.risk_management.trailing_stop_loss * 100) / 100,
                  min: 0.5,
                  max: 10,
                  step: 0.1,
                  unit: '%',
                  color: 'blue'
                }}
                onChange={(value) => handleParameterChange('risk_management', 'trailing_stop_loss', value)}
                isEditing={true}
              />
              <StrategyParameterEditor
                parameter={{
                  name: 'Max Drawdown',
                  value: Math.round(config.risk_management.max_drawdown * 100) / 100,
                  min: 5,
                  max: 30,
                  step: 0.5,
                  unit: '%',
                  color: 'orange'
                }}
                onChange={(value) => handleParameterChange('risk_management', 'max_drawdown', value)}
                isEditing={true}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gunmetal-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Strategy Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-400 line-clamp-2">{strategy.description}</p>
          </div>

          {/* Strategy Configuration */}
          {config && (
            <div className="space-y-6">
              {/* Market & Assets */}
              <div>
                <h4 className="text-sm font-semibold text-gray-200 mb-4">Trading Assets</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assetData.map((asset) => (
                    <div key={asset.symbol} className="bg-gunmetal-800/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-200">{asset.symbol.replace('_', '/')}</h3>
                        <div className={`flex items-center ${asset.change24h >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
                          {asset.change24h >= 0 ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5" />
                          )}
                          <span className="font-semibold">
                            {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-200">
                        ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trading Parameters */}
              <div>
                <h4 className="text-sm font-semibold text-gray-200 mb-2">Trading Parameters</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Leverage',
                      value: Math.round(config.trade_parameters.leverage * 100) / 100,
                      min: 1,
                      max: 20,
                      step: 1,
                      unit: 'x'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Position Size',
                      value: Math.round(config.trade_parameters.position_size * 10000) / 100,
                      min: 1,
                      max: 100,
                      step: 1,
                      unit: '%'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Confidence',
                      value: Math.round(config.trade_parameters.confidence_factor * 100),
                      min: 10,
                      max: 100,
                      step: 1,
                      unit: '%'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                </div>
              </div>

              {/* Risk Management */}
              <div>
                <h4 className="text-sm font-semibold text-gray-200 mb-2">Risk Management</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Stop Loss',
                      value: Math.round(config.risk_management.stop_loss * 100) / 100,
                      min: 0.5,
                      max: 10,
                      step: 0.1,
                      unit: '%',
                      color: 'red'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Take Profit',
                      value: Math.round(config.risk_management.take_profit * 100) / 100,
                      min: 1,
                      max: 20,
                      step: 0.1,
                      unit: '%',
                      color: 'green'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Trailing Stop',
                      value: Math.round(config.risk_management.trailing_stop_loss * 100) / 100,
                      min: 0.5,
                      max: 10,
                      step: 0.1,
                      unit: '%',
                      color: 'blue'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                  <StrategyParameterEditor
                    parameter={{
                      name: 'Max Drawdown',
                      value: Math.round(config.risk_management.max_drawdown * 100) / 100,
                      min: 5,
                      max: 30,
                      step: 0.5,
                      unit: '%',
                      color: 'orange'
                    }}
                    onChange={() => {}}
                    isEditing={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}