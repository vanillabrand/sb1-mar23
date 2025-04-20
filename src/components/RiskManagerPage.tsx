import React, { useState } from 'react';
import { Shield, AlertTriangle, TrendingUp, BarChart2, Activity } from 'lucide-react';
import { RiskMetricsCard } from './RiskMetricsCard';
import { AssetRiskTable } from './AssetRiskTable';
import { RiskHeatmap } from './RiskHeatmap';
import { PortfolioRiskChart } from './PortfolioRiskChart';

// Define mock types for the component
type Strategy = {
  id: string;
  title: string;
  status: string;
  riskLevel: string;
  marketType?: string;
  selected_pairs?: string[];
  budget?: {
    total: number;
    allocated: number;
    available: number;
  };
};

export const RiskManagerPage: React.FC = () => {
  // Mock data for demonstration
  const [portfolioRisk] = useState({
    totalRisk: 42.5,
    maxDrawdown: 8.3,
    volatilityScore: 38.7,
    correlationScore: 45.2
  });

  const [assetRisks] = useState([
    { symbol: 'BTC/USDT', volatility: 45, regime: 'trending', riskScore: 38, liquidity: 85 },
    { symbol: 'ETH/USDT', volatility: 52, regime: 'volatile', riskScore: 56, liquidity: 78 },
    { symbol: 'SOL/USDT', volatility: 68, regime: 'volatile', riskScore: 72, liquidity: 65 }
  ]);

  const [activeStrategies] = useState<Strategy[]>([
    {
      id: '1',
      title: 'BTC Momentum Strategy',
      status: 'active',
      riskLevel: 'Medium',
      marketType: 'spot',
      selected_pairs: ['BTC/USDT'],
      budget: {
        total: 10000,
        allocated: 5000,
        available: 5000
      }
    },
    {
      id: '2',
      title: 'ETH Swing Trading',
      status: 'active',
      riskLevel: 'High',
      marketType: 'spot',
      selected_pairs: ['ETH/USDT'],
      budget: {
        total: 5000,
        allocated: 2500,
        available: 2500
      }
    }
  ]);

  const [marketAnalyses] = useState({});

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
            {activeStrategies.map((strategy) => (
              <div
                key={strategy.id}
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
                </div>

                {/* Strategy Risk Parameters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-900/50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Max Position Size</div>
                    <div className="text-white font-medium flex items-center">
                      10.0%
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
                    <div className="text-white font-medium flex items-center">
                      2.0%
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Take Profit</div>
                    <div className="text-white font-medium flex items-center">
                      4.0%
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded">
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
                        assets={[
                          { symbol: 'BTC/USDT', analysis: { volatility: 45, regime: 'trending', riskScore: 38, liquidity: { score: 85 } } }
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
