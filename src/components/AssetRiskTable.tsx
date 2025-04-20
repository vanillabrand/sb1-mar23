import React from 'react';
import { Activity, TrendingUp, TrendingDown, Droplet } from 'lucide-react';
import type { MarketAnalysis } from '../lib/types';

interface AssetRiskTableProps {
  assets: Array<{
    symbol: string;
    analysis: MarketAnalysis | null;
  }>;
}

export const AssetRiskTable: React.FC<AssetRiskTableProps> = ({ assets }) => {
  if (!assets || assets.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        No assets to display
      </div>
    );
  }

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'trending':
        return 'text-neon-turquoise';
      case 'ranging':
        return 'text-neon-yellow';
      case 'volatile':
        return 'text-neon-orange';
      case 'bearish':
        return 'text-neon-raspberry';
      default:
        return 'text-gray-400';
    }
  };

  const getRegimeIcon = (regime: string) => {
    switch (regime) {
      case 'trending':
        return <TrendingUp className="w-4 h-4" />;
      case 'ranging':
        return <Activity className="w-4 h-4" />;
      case 'volatile':
        return <TrendingDown className="w-4 h-4" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-400';
    if (score < 60) return 'text-neon-yellow';
    if (score < 80) return 'text-neon-orange';
    return 'text-neon-raspberry';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gunmetal-700">
            <th className="text-left py-2 px-4 text-gray-400">Asset</th>
            <th className="text-center py-2 px-4 text-gray-400">Volatility</th>
            <th className="text-center py-2 px-4 text-gray-400">Market Regime</th>
            <th className="text-center py-2 px-4 text-gray-400">Liquidity</th>
            <th className="text-center py-2 px-4 text-gray-400">Risk Score</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.symbol} className="border-b border-gunmetal-800/30">
              <td className="py-3 px-4 text-gray-300">{asset.symbol}</td>
              <td className="py-3 px-4 text-center">
                {asset.analysis ? (
                  <div className="flex items-center justify-center">
                    <div className="w-20 bg-gunmetal-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          asset.analysis.volatility > 70 ? 'bg-neon-raspberry' : 
                          asset.analysis.volatility > 40 ? 'bg-neon-yellow' : 
                          'bg-neon-turquoise'
                        }`}
                        style={{ width: `${asset.analysis.volatility}%` }}
                      />
                    </div>
                    <span className="ml-2 text-gray-300">{asset.analysis.volatility.toFixed(0)}%</span>
                  </div>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {asset.analysis ? (
                  <div className="flex items-center justify-center">
                    <span className={`flex items-center ${getRegimeColor(asset.analysis.regime)}`}>
                      {getRegimeIcon(asset.analysis.regime)}
                      <span className="ml-1 capitalize">{asset.analysis.regime}</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {asset.analysis && asset.analysis.liquidity ? (
                  <div className="flex items-center justify-center">
                    <Droplet className="w-4 h-4 text-blue-400 mr-1" />
                    <span className="text-gray-300">{asset.analysis.liquidity.score.toFixed(0)}%</span>
                  </div>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {asset.analysis ? (
                  <span className={getRiskColor(asset.analysis.riskScore || 50)}>
                    {(asset.analysis.riskScore || 50).toFixed(0)}/100
                  </span>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
