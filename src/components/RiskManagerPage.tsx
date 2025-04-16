import React, { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, TrendingUp, BarChart2, Activity, Zap, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';
import { riskManagementService } from '../lib/risk-management-service';
import { marketAnalysisService } from '../lib/market-analysis-service';
import { strategyService } from '../lib/strategy-service';
import { Strategy, RiskLevel, MarketAnalysis, RiskManagementConfig } from '../lib/types';
import { RiskLevelSlider } from './RiskLevelSlider';
import { RiskMetricsCard } from './RiskMetricsCard';
import { AssetRiskTable } from './AssetRiskTable';
import { RiskHeatmap } from './RiskHeatmap';
import { PortfolioRiskChart } from './PortfolioRiskChart';
import { LoadingSpinner } from './LoadingSpinner';

export const RiskManagerPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStrategies, setActiveStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [portfolioRisk, setPortfolioRisk] = useState<{
    totalRisk: number;
    maxDrawdown: number;
    volatilityScore: number;
    correlationScore: number;
  }>({
    totalRisk: 0,
    maxDrawdown: 0,
    volatilityScore: 0,
    correlationScore: 0
  });
  const [assetRisks, setAssetRisks] = useState<Array<{
    symbol: string;
    volatility: number;
    regime: string;
    riskScore: number;
    liquidity: number;
  }>>([]);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const wsInitialized = useRef(false);

  // Fetch strategies and set up WebSocket connection
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        const allStrategies = await strategyService.getAllStrategies();
        setStrategies(allStrategies);
        
        // Filter active strategies
        const active = allStrategies.filter(s => s.status === 'active');
        setActiveStrategies(active);
        
        // Initialize market analysis service
        await marketAnalysisService.initialize();
        
        // Fetch market analyses for all trading pairs in active strategies
        const uniquePairs = [...new Set(active.flatMap(s => s.selected_pairs || []))];
        const analyses: Record<string, MarketAnalysis> = {};
        
        for (const pair of uniquePairs) {
          try {
            const analysis = await marketAnalysisService.getMarketAnalysis(pair);
            analyses[pair] = analysis;
          } catch (error) {
            logService.log('error', `Failed to get market analysis for ${pair}`, error, 'RiskManagerPage');
          }
        }
        
        setMarketAnalyses(analyses);
        
        // Calculate portfolio risk metrics
        calculatePortfolioRisk(active, analyses);
        
        // Calculate asset risk metrics
        calculateAssetRisks(uniquePairs, analyses);
        
        setIsLoading(false);
      } catch (error) {
        logService.log('error', 'Failed to fetch strategies', error, 'RiskManagerPage');
        setIsLoading(false);
      }
    };

    fetchStrategies();

    // Set up WebSocket connection for real-time updates
    if (!wsInitialized.current) {
      setupWebSocket();
      wsInitialized.current = true;
    }

    return () => {
      // Clean up WebSocket listeners when component unmounts
      websocketService.off('strategy:updated');
      websocketService.off('market:analysis:updated');
      websocketService.off('connected');
      websocketService.off('disconnected');
    };
  }, []);

  // Set up WebSocket connection and listeners
  const setupWebSocket = async () => {
    try {
      // Check if WebSocket is already connected
      if (!websocketService.getConnectionStatus()) {
        await websocketService.connect({});
      }
      
      setIsWebSocketConnected(websocketService.getConnectionStatus());
      
      // Listen for WebSocket connection status changes
      websocketService.on('connected', () => {
        setIsWebSocketConnected(true);
        logService.log('info', 'WebSocket connected', null, 'RiskManagerPage');
      });
      
      websocketService.on('disconnected', () => {
        setIsWebSocketConnected(false);
        logService.log('info', 'WebSocket disconnected', null, 'RiskManagerPage');
      });
      
      // Listen for strategy updates
      websocketService.on('strategy:updated', async (data: any) => {
        if (data && data.strategy) {
          // Update the strategy in the list
          setStrategies(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.id === data.strategy.id);
            if (index !== -1) {
              updated[index] = data.strategy;
            }
            return updated;
          });
          
          // Update active strategies if needed
          if (data.strategy.status === 'active') {
            setActiveStrategies(prev => {
              const updated = [...prev];
              const index = updated.findIndex(s => s.id === data.strategy.id);
              if (index !== -1) {
                updated[index] = data.strategy;
              } else {
                updated.push(data.strategy);
              }
              return updated;
            });
          } else {
            setActiveStrategies(prev => prev.filter(s => s.id !== data.strategy.id));
          }
        }
      });
      
      // Listen for market analysis updates
      websocketService.on('market:analysis:updated', (data: any) => {
        if (data && data.symbol && data.analysis) {
          setMarketAnalyses(prev => ({
            ...prev,
            [data.symbol]: data.analysis
          }));
          
          // Recalculate portfolio risk when market analysis is updated
          setActiveStrategies(activeStrategies => {
            calculatePortfolioRisk(activeStrategies, {
              ...marketAnalyses,
              [data.symbol]: data.analysis
            });
            return activeStrategies;
          });
          
          // Update asset risks
          setAssetRisks(prev => {
            const index = prev.findIndex(a => a.symbol === data.symbol);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = {
                symbol: data.symbol,
                volatility: data.analysis.volatility,
                regime: data.analysis.regime,
                riskScore: calculateAssetRiskScore(data.analysis),
                liquidity: data.analysis.liquidity?.score || 50
              };
              return updated;
            }
            return prev;
          });
        }
      });
      
      // Subscribe to active strategies
      for (const strategy of activeStrategies) {
        try {
          await websocketService.subscribeToStrategy(strategy.id);
          
          // Subscribe to market data for all trading pairs
          if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
            await websocketService.batchSubscribeToMarketData(strategy.selected_pairs);
          }
        } catch (error) {
          logService.log('error', `Failed to subscribe to strategy ${strategy.id}`, error, 'RiskManagerPage');
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to set up WebSocket connection', error, 'RiskManagerPage');
    }
  };

  // Calculate portfolio risk metrics
  const calculatePortfolioRisk = (strategies: Strategy[], analyses: Record<string, MarketAnalysis>) => {
    if (strategies.length === 0) {
      setPortfolioRisk({
        totalRisk: 0,
        maxDrawdown: 0,
        volatilityScore: 0,
        correlationScore: 0
      });
      return;
    }
    
    // Calculate weighted average volatility across all assets
    let totalVolatility = 0;
    let totalAssets = 0;
    
    for (const strategy of strategies) {
      if (strategy.selected_pairs) {
        for (const pair of strategy.selected_pairs) {
          if (analyses[pair]) {
            totalVolatility += analyses[pair].volatility;
            totalAssets++;
          }
        }
      }
    }
    
    const avgVolatility = totalAssets > 0 ? totalVolatility / totalAssets : 50;
    
    // Calculate max drawdown based on risk levels
    let maxDrawdown = 0;
    for (const strategy of strategies) {
      const config = riskManagementService.getRiskConfig(strategy.riskLevel);
      maxDrawdown = Math.max(maxDrawdown, config.maxDrawdown * 100);
    }
    
    // Calculate correlation score (simplified)
    // In a real implementation, this would calculate actual correlations between assets
    const correlationScore = Math.min(100, Math.max(0, 50 + (strategies.length - 1) * 5));
    
    // Calculate total portfolio risk score
    const totalRisk = (avgVolatility * 0.4) + (maxDrawdown * 0.4) + (correlationScore * 0.2);
    
    setPortfolioRisk({
      totalRisk: Math.min(100, Math.max(0, totalRisk)),
      maxDrawdown,
      volatilityScore: avgVolatility,
      correlationScore
    });
  };

  // Calculate asset risk metrics
  const calculateAssetRisks = (symbols: string[], analyses: Record<string, MarketAnalysis>) => {
    const risks = symbols.map(symbol => {
      const analysis = analyses[symbol];
      if (!analysis) {
        return {
          symbol,
          volatility: 50,
          regime: 'unknown',
          riskScore: 50,
          liquidity: 50
        };
      }
      
      return {
        symbol,
        volatility: analysis.volatility,
        regime: analysis.regime,
        riskScore: calculateAssetRiskScore(analysis),
        liquidity: analysis.liquidity?.score || 50
      };
    });
    
    setAssetRisks(risks);
  };

  // Calculate risk score for an asset based on its market analysis
  const calculateAssetRiskScore = (analysis: MarketAnalysis): number => {
    if (!analysis) return 50;
    
    // Factors that increase risk
    const volatilityFactor = analysis.volatility * 0.4;
    const regimeFactor = analysis.regime === 'volatile' ? 30 : analysis.regime === 'trending' ? 15 : 10;
    const liquidityFactor = (100 - (analysis.liquidity?.score || 50)) * 0.3;
    
    // Calculate total risk score
    const riskScore = volatilityFactor + regimeFactor + liquidityFactor;
    
    return Math.min(100, Math.max(0, riskScore));
  };

  // Handle risk level change for a strategy
  const handleRiskLevelChange = async (strategyId: string, newRiskLevel: RiskLevel) => {
    try {
      // Update the strategy in the database
      const updatedStrategy = await strategyService.updateStrategy(strategyId, {
        riskLevel: newRiskLevel
      });
      
      // Update the strategy in the local state
      setStrategies(prev => {
        const updated = [...prev];
        const index = updated.findIndex(s => s.id === strategyId);
        if (index !== -1) {
          updated[index] = updatedStrategy;
        }
        return updated;
      });
      
      // Update active strategies if needed
      if (updatedStrategy.status === 'active') {
        setActiveStrategies(prev => {
          const updated = [...prev];
          const index = updated.findIndex(s => s.id === strategyId);
          if (index !== -1) {
            updated[index] = updatedStrategy;
          }
          return updated;
        });
        
        // Recalculate portfolio risk
        calculatePortfolioRisk([...activeStrategies], marketAnalyses);
      }
      
      // Emit event for WebSocket to broadcast
      websocketService.send({
        type: 'strategy:update',
        strategyId,
        updates: { riskLevel: newRiskLevel }
      }).catch(error => {
        logService.log('error', `Failed to send strategy update via WebSocket`, error, 'RiskManagerPage');
      });
      
      logService.log('info', `Updated risk level for strategy ${strategyId} to ${newRiskLevel}`, null, 'RiskManagerPage');
    } catch (error) {
      logService.log('error', `Failed to update risk level for strategy ${strategyId}`, error, 'RiskManagerPage');
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-black min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <Shield className="w-6 h-6 text-neon-pink mr-2" />
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Risk Manager</h1>
        </div>
        <p className="text-gray-400">
          Monitor and manage risk across your active trading strategies
          {isWebSocketConnected && (
            <span className="ml-2 text-neon-turquoise text-sm">• Live Updates</span>
          )}
        </p>
      </div>

      {/* Portfolio Risk Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Portfolio Risk Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskMetricsCard 
            title="Total Risk Exposure" 
            value={`${portfolioRisk.totalRisk.toFixed(1)}%`} 
            icon={<AlertTriangle className="w-5 h-5" />}
            color={portfolioRisk.totalRisk > 70 ? 'red' : portfolioRisk.totalRisk > 40 ? 'yellow' : 'green'}
            description="Overall portfolio risk level"
          />
          <RiskMetricsCard 
            title="Max Drawdown" 
            value={`${portfolioRisk.maxDrawdown.toFixed(1)}%`} 
            icon={<TrendingUp className="w-5 h-5" />}
            color={portfolioRisk.maxDrawdown > 15 ? 'red' : portfolioRisk.maxDrawdown > 8 ? 'yellow' : 'green'}
            description="Maximum potential loss"
          />
          <RiskMetricsCard 
            title="Volatility Score" 
            value={`${portfolioRisk.volatilityScore.toFixed(1)}`} 
            icon={<Activity className="w-5 h-5" />}
            color={portfolioRisk.volatilityScore > 70 ? 'red' : portfolioRisk.volatilityScore > 40 ? 'yellow' : 'green'}
            description="Market price fluctuation"
          />
          <RiskMetricsCard 
            title="Correlation Score" 
            value={`${portfolioRisk.correlationScore.toFixed(1)}`} 
            icon={<BarChart2 className="w-5 h-5" />}
            color={portfolioRisk.correlationScore > 70 ? 'red' : portfolioRisk.correlationScore > 40 ? 'yellow' : 'green'}
            description="Asset correlation level"
          />
        </div>
      </div>

      {/* Risk Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="panel-metallic p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Portfolio Risk Distribution</h3>
          <PortfolioRiskChart 
            strategies={activeStrategies} 
            marketAnalyses={marketAnalyses} 
          />
        </div>
        <div className="panel-metallic p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Asset Risk Heatmap</h3>
          <RiskHeatmap assetRisks={assetRisks} />
        </div>
      </div>

      {/* Active Strategies Risk Management */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Active Strategies Risk Management</h2>
        {activeStrategies.length === 0 ? (
          <div className="panel-metallic p-6 rounded-lg text-center">
            <p className="text-gray-400">No active strategies found. Activate a strategy to manage its risk.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {activeStrategies.map((strategy) => (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="panel-metallic p-4 rounded-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{strategy.title}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-sm text-gray-400 mr-3">
                          {strategy.marketType || 'spot'}
                        </span>
                        <span className={`text-sm px-2 py-0.5 rounded ${
                          strategy.riskLevel === 'Ultra Low' || strategy.riskLevel === 'Low' 
                            ? 'bg-green-900/30 text-green-400' 
                            : strategy.riskLevel === 'Medium' 
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {strategy.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0 w-full md:w-1/2 lg:w-1/3">
                      <RiskLevelSlider 
                        value={strategy.riskLevel} 
                        onChange={(newLevel) => handleRiskLevelChange(strategy.id, newLevel)} 
                      />
                    </div>
                  </div>
                  
                  {/* Strategy Risk Parameters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {(() => {
                      const config = riskManagementService.getRiskConfig(strategy.riskLevel);
                      return (
                        <>
                          <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-xs text-gray-500 mb-1">Max Position Size</div>
                            <div className="text-white font-medium flex items-center">
                              <Percent className="w-3 h-3 mr-1 text-neon-turquoise" />
                              {(config.maxPositionSizePercentage * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
                            <div className="text-white font-medium flex items-center">
                              <Percent className="w-3 h-3 mr-1 text-neon-pink" />
                              {(config.fixedStopLossPercentage ? config.fixedStopLossPercentage * 100 : 2).toFixed(1)}%
                            </div>
                          </div>
                          <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-xs text-gray-500 mb-1">Take Profit</div>
                            <div className="text-white font-medium flex items-center">
                              <Percent className="w-3 h-3 mr-1 text-neon-turquoise" />
                              {(config.fixedTakeProfitPercentage ? config.fixedTakeProfitPercentage * 100 : 4).toFixed(1)}%
                            </div>
                          </div>
                          <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-xs text-gray-500 mb-1">Max Risk Per Trade</div>
                            <div className="text-white font-medium flex items-center">
                              <Percent className="w-3 h-3 mr-1 text-neon-pink" />
                              {(config.maxRiskPerTrade * 100).toFixed(1)}%
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Trading Pairs Risk Analysis */}
                  {strategy.selected_pairs && strategy.selected_pairs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Trading Pairs Risk Analysis</h4>
                      <div className="overflow-x-auto">
                        <AssetRiskTable 
                          assets={strategy.selected_pairs.map(pair => ({
                            symbol: pair,
                            analysis: marketAnalyses[pair] || null
                          }))} 
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
