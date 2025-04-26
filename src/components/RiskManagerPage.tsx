import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, BarChart2, Activity, Loader2 } from 'lucide-react';
import { RiskMetricsCard } from './RiskMetricsCard';
import { AssetRiskTable } from './AssetRiskTable';
import { RiskHeatmap } from './RiskHeatmap';
import { PortfolioRiskChart } from './PortfolioRiskChart';
import { supabase } from '../lib/supabase';
import { demoService } from '../lib/demo-service';
import { marketAnalyzer } from '../lib/market-analyzer';
import { logService } from '../lib/log-service';
import { exchangeService } from '../lib/exchange-service';
import { riskManagementService } from '../lib/risk-management-service';
import type { Strategy, MarketAnalysis } from '../lib/types';

export const RiskManagerPage: React.FC = () => {
  // State for risk data
  const [portfolioRisk, setPortfolioRisk] = useState({
    totalRisk: 0,
    maxDrawdown: 0,
    volatilityScore: 0,
    correlationScore: 0
  });

  const [assetRisks, setAssetRisks] = useState([
    { symbol: 'BTC/USDT', volatility: 45, regime: 'trending', riskScore: 38, liquidity: 85 },
    { symbol: 'ETH/USDT', volatility: 52, regime: 'volatile', riskScore: 56, liquidity: 78 },
    { symbol: 'SOL/USDT', volatility: 68, regime: 'volatile', riskScore: 72, liquidity: 65 }
  ]);

  const [activeStrategies, setActiveStrategies] = useState<Strategy[]>([]);
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to refresh risk data
  const refreshRiskData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Re-initialize market analyzer
      await marketAnalyzer.initialize();

      // Get market analyses for all pairs
      const allPairs = new Set<string>();
      activeStrategies.forEach(strategy => {
        (strategy.selected_pairs || []).forEach(pair => {
          allPairs.add(pair);
        });
      });

      // If no pairs found, don't proceed with refresh
      if (allPairs.size === 0) {
        setRefreshing(false);
        return;
      }

      // Get fresh market analyses for all pairs
      const analyses: Record<string, MarketAnalysis> = {};
      for (const pair of allPairs) {
        try {
          // Get real-time market data
          const marketData = await exchangeService.getMarketPrice(pair);
          const analysis = await marketAnalyzer.analyzeMarket(pair, marketData);
          analyses[pair] = analysis;
        } catch (error) {
          logService.log('warn', `Failed to refresh analysis for ${pair}`, error, 'RiskManagerPage');
          // Keep existing analysis if available
          if (marketAnalyses[pair]) {
            analyses[pair] = marketAnalyses[pair];
          }
        }
      }

      setMarketAnalyses(analyses);

      // Recalculate portfolio risk metrics with fresh data
      const riskMetrics = await calculatePortfolioRisk(activeStrategies, analyses);
      setPortfolioRisk(riskMetrics);

      // Update asset risks display
      const formattedAssetRisks = Object.values(analyses).map(analysis => ({
        symbol: analysis.symbol,
        volatility: analysis.volatility,
        regime: analysis.regime,
        riskScore: analysis.riskScore,
        liquidity: analysis.liquidity.score
      }));
      setAssetRisks(formattedAssetRisks);

      logService.log('info', 'Risk data refreshed successfully', null, 'RiskManagerPage');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh risk data';
      setError(errorMessage);
      logService.log('error', 'Failed to refresh risk data', error, 'RiskManagerPage');
    } finally {
      setRefreshing(false);
    }
  };

  // Load strategies and risk data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize market analyzer
        await marketAnalyzer.initialize();

        // Fetch strategies from database
        const { data: strategies, error: strategiesError } = await supabase
          .from('strategies')
          .select('*')
          .order('created_at', { ascending: false });

        if (strategiesError) {
          throw strategiesError;
        }

        // Filter active strategies
        let activeStrategies = strategies?.filter(s => s.status === 'active') || [];

        // If no active strategies and in demo mode, create a demo strategy
        if (activeStrategies.length === 0 && demoService.isInDemoMode()) {
          const demoStrategies = [
            {
              id: 'demo-1',
              title: 'BTC Momentum Strategy',
              status: 'active',
              risk_level: 'Medium',
              market_type: 'spot',
              selected_pairs: ['BTC/USDT'],
              budget: {
                total: 10000,
                allocated: 5000,
                available: 5000
              }
            },
            {
              id: 'demo-2',
              title: 'ETH Swing Trading',
              status: 'active',
              risk_level: 'High',
              market_type: 'spot',
              selected_pairs: ['ETH/USDT'],
              budget: {
                total: 5000,
                allocated: 2500,
                available: 2500
              }
            }
          ];
          activeStrategies = demoStrategies as unknown as Strategy[];
        }

        setActiveStrategies(activeStrategies);

        // Get market analyses for all trading pairs
        const allPairs = new Set<string>();
        activeStrategies.forEach(strategy => {
          (strategy.selected_pairs || []).forEach(pair => {
            allPairs.add(pair);
          });
        });

        // If no pairs found, add default ones
        if (allPairs.size === 0) {
          allPairs.add('BTC/USDT');
          allPairs.add('ETH/USDT');
          allPairs.add('SOL/USDT');
        }

        // Get market analyses for all pairs using real-time data
        const analyses: Record<string, MarketAnalysis> = {};
        for (const pair of allPairs) {
          try {
            // Get real-time market data from exchange service
            const marketData = await exchangeService.getMarketPrice(pair);

            // Use market analyzer to get detailed analysis with real-time data
            const analysis = await marketAnalyzer.analyzeMarket(pair, marketData);

            // Log successful analysis
            logService.log('info', `Successfully analyzed market for ${pair} using live data`,
              { volatility: analysis.volatility, regime: analysis.regime }, 'RiskManagerPage');

            analyses[pair] = analysis;
          } catch (error) {
            logService.log('warn', `Failed to analyze market for ${pair} with live data, trying fallback method`,
              error, 'RiskManagerPage');

            try {
              // Try fallback method with historical data
              const analysis = await marketAnalyzer.analyzeMarket(pair);
              analyses[pair] = analysis;

              logService.log('info', `Used fallback analysis for ${pair}`,
                { volatility: analysis.volatility, regime: analysis.regime }, 'RiskManagerPage');
            } catch (fallbackError) {
              logService.log('error', `All analysis methods failed for ${pair}, using synthetic data`,
                fallbackError, 'RiskManagerPage');

              // Create a synthetic analysis as last resort fallback
              analyses[pair] = {
                symbol: pair,
                volatility: 40, // Default medium volatility
                regime: 'neutral',
                riskScore: 50, // Default medium risk
                liquidity: {
                  score: 70, // Default good liquidity
                  spreadPercentage: 0.2,
                  depth: 500000
                }
              };
            }
          }
        }
        setMarketAnalyses(analyses);

        // Calculate portfolio risk metrics
        const riskMetrics = await calculatePortfolioRisk(activeStrategies, analyses);
        setPortfolioRisk(riskMetrics);

        // Format asset risks for display
        const formattedAssetRisks = Object.values(analyses).map(analysis => ({
          symbol: analysis.symbol,
          volatility: analysis.volatility,
          regime: analysis.regime,
          riskScore: analysis.riskScore,
          liquidity: analysis.liquidity.score
        }));
        setAssetRisks(formattedAssetRisks);

        setLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load risk data';
        setError(errorMessage);
        logService.log('error', 'Failed to load risk data', error, 'RiskManagerPage');
        setLoading(false);
      }
    };

    loadData();

    // Cleanup
    return () => {
      marketAnalyzer.cleanup();
    };
  }, []);

  // Calculate portfolio risk metrics
  const calculatePortfolioRisk = async (strategies: Strategy[], analyses: Record<string, MarketAnalysis>) => {
    try {
      // If no strategies, return default values
      if (!strategies || strategies.length === 0) {
        return {
          totalRisk: 0,
          maxDrawdown: 0,
          volatilityScore: 0,
          correlationScore: 0
        };
      }

      // Get risk metrics from risk management service
      try {
        logService.log('info', 'Calculating portfolio risk using risk management service',
          { strategyCount: strategies.length }, 'RiskManagerPage');

        const riskMetrics = await riskManagementService.calculatePortfolioRisk(strategies);

        return {
          totalRisk: riskMetrics.totalRiskScore,
          maxDrawdown: riskMetrics.maxDrawdown,
          volatilityScore: riskMetrics.volatilityScore,
          correlationScore: riskMetrics.correlationScore
        };
      } catch (error) {
        logService.log('warn', 'Failed to get risk metrics from service, using fallback calculation',
          error, 'RiskManagerPage');
      }

      // Fallback calculation if the service fails
      logService.log('info', 'Using fallback risk calculation', null, 'RiskManagerPage');

      // Calculate risk metrics based on strategies and market analyses
      let totalRisk = 0;
      let maxDrawdown = 0;
      let volatilityScore = 0;
      let correlationScore = 0;

      // Calculate weighted average of risk metrics
      let totalWeight = 0;
      strategies.forEach(strategy => {
        const weight = strategy.budget?.total || 1;
        totalWeight += weight;

        // Get average volatility of strategy pairs
        let strategyVolatility = 0;
        let pairCount = 0;
        (strategy.selected_pairs || []).forEach(pair => {
          if (analyses[pair]) {
            strategyVolatility += analyses[pair].volatility || 40; // Default to 40 if volatility is missing
            pairCount++;
          }
        });
        strategyVolatility = pairCount > 0 ? strategyVolatility / pairCount : 40;

        // Calculate risk metrics based on strategy risk level and volatility
        const riskMultiplier =
          strategy.risk_level === 'Ultra Low' ? 0.5 :
          strategy.risk_level === 'Low' ? 0.75 :
          strategy.risk_level === 'Medium' ? 1.0 :
          strategy.risk_level === 'High' ? 1.25 :
          strategy.risk_level === 'Ultra High' ? 1.5 :
          strategy.risk_level === 'Extreme' ? 1.75 :
          strategy.risk_level === 'God Mode' ? 2.0 : 1.0;

        totalRisk += (strategyVolatility * riskMultiplier * weight);
        maxDrawdown += (strategyVolatility * 0.2 * riskMultiplier * weight); // Estimate max drawdown as 20% of volatility
        volatilityScore += (strategyVolatility * weight);
      });

      // Normalize by total weight
      if (totalWeight > 0) {
        totalRisk /= totalWeight;
        maxDrawdown /= totalWeight;
        volatilityScore /= totalWeight;
      } else {
        // If no weight, use default values
        totalRisk = 40;
        maxDrawdown = 8;
        volatilityScore = 40;
      }

      // Calculate correlation score based on pair diversity
      const uniquePairs = new Set<string>();
      strategies.forEach(strategy => {
        (strategy.selected_pairs || []).forEach(pair => {
          uniquePairs.add(pair);
        });
      });

      // More unique pairs = lower correlation
      correlationScore = Math.max(0, 100 - (uniquePairs.size * 10));

      // Ensure all values are valid numbers
      totalRisk = isNaN(totalRisk) ? 40 : totalRisk;
      maxDrawdown = isNaN(maxDrawdown) ? 8 : maxDrawdown;
      volatilityScore = isNaN(volatilityScore) ? 40 : volatilityScore;
      correlationScore = isNaN(correlationScore) ? 50 : correlationScore;

      return {
        totalRisk,
        maxDrawdown,
        volatilityScore,
        correlationScore
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate portfolio risk', error, 'RiskManagerPage');
      // Return safe default values
      return {
        totalRisk: 40,
        maxDrawdown: 8,
        volatilityScore: 40,
        correlationScore: 50
      };
    }
  };

  return (
    <div className="p-4 md:p-6 bg-black min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Shield className="w-6 h-6 text-neon-pink mr-2" />
            <h1 className="text-2xl font-bold gradient-text">Risk Manager</h1>
          </div>
          {activeStrategies.length > 0 && (
            <button
              onClick={refreshRiskData}
              disabled={refreshing || loading}
              className="flex items-center px-3 py-1.5 rounded-md bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 text-neon-turquoise mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-neon-turquoise mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className="text-sm text-gray-300">{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          )}
        </div>
        <p className="text-gray-400 mt-2">
          Monitor and manage risk across your active trading strategies
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-raspberry"></div>
          <span className="ml-3 text-gray-400">Loading risk data...</span>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Portfolio Risk Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold gradient-text mb-4">Portfolio Risk Overview</h2>
            {activeStrategies.length === 0 ? (
              <div className="panel-metallic rounded-xl p-6 text-center">
                <div className="flex flex-col items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-neon-yellow mb-4" />
                  <p className="text-gray-300 text-lg mb-2">No active strategies found</p>
                  <p className="text-gray-400">Please activate a strategy to start viewing risk analytics</p>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Risk Visualization */}
          {activeStrategies.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
                <h3 className="text-lg font-semibold gradient-text mb-4">Portfolio Risk Distribution</h3>
                <PortfolioRiskChart
                  strategies={activeStrategies as any}
                  marketAnalyses={marketAnalyses}
                />
              </div>
              <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
                <h3 className="text-lg font-semibold gradient-text mb-4">Asset Risk Heatmap</h3>
                <RiskHeatmap assetRisks={assetRisks} />
              </div>
            </div>
          )}

          {/* Active Strategies Risk Management */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold gradient-text mb-4">Active Strategies Risk Management</h2>
            {activeStrategies.length === 0 ? (
              <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 text-center">
                <p className="text-gray-400">No active strategies found. Activate a strategy to manage its risk.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStrategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold gradient-text">{strategy.title}</h3>
                        <div className="flex items-center mt-1">
                          <span className="text-sm text-gray-400 mr-3">
                            {strategy.market_type || 'spot'}
                          </span>
                          <span className={`text-sm px-2 py-0.5 rounded ${
                            strategy.risk_level === 'Ultra Low' || strategy.risk_level === 'Low'
                              ? 'bg-green-900/30 text-green-400'
                              : strategy.risk_level === 'Medium'
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {strategy.risk_level}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Strategy Risk Parameters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gunmetal-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Max Position Size</div>
                        <div className="text-white font-medium flex items-center">
                          10.0%
                        </div>
                      </div>
                      <div className="bg-gunmetal-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
                        <div className="text-white font-medium flex items-center">
                          2.0%
                        </div>
                      </div>
                      <div className="bg-gunmetal-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Take Profit</div>
                        <div className="text-white font-medium flex items-center">
                          4.0%
                        </div>
                      </div>
                      <div className="bg-gunmetal-800/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Max Risk Per Trade</div>
                        <div className="text-white font-medium flex items-center">
                          1.0%
                        </div>
                      </div>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
