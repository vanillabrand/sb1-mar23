import React from 'react';
import { ResponsiveContainer, Tooltip, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Cell } from 'recharts';

interface AssetRisk {
  symbol: string;
  volatility: number;
  regime: string;
  riskScore: number;
  liquidity: number;
}

interface RiskHeatmapProps {
  assetRisks: AssetRisk[];
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ assetRisks }) => {
  if (!assetRisks || assetRisks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No asset risk data available
      </div>
    );
  }

  // Transform data for the scatter chart
  const chartData = assetRisks.map(risk => ({
    x: risk.volatility, // X-axis: Volatility
    y: risk.liquidity,  // Y-axis: Liquidity
    z: risk.riskScore,  // Z-axis (bubble size): Risk Score
    symbol: risk.symbol,
    regime: risk.regime
  }));

  // Get color based on risk score
  const getColor = (score: number) => {
    if (score < 30) return '#10b981'; // Green
    if (score < 60) return '#facc15'; // Yellow
    if (score < 80) return '#fb923c'; // Orange
    return '#FF1493'; // Raspberry
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm font-bold mb-1">{data.symbol}</p>
          <p className="text-neon-turquoise text-xs">Volatility: {data.x}%</p>
          <p className="text-blue-400 text-xs">Liquidity: {data.y}%</p>
          <p className={`text-xs ${
            data.z < 30 ? 'text-green-400' :
            data.z < 60 ? 'text-neon-yellow' :
            data.z < 80 ? 'text-neon-orange' :
            'text-neon-raspberry'
          }`}>
            Risk Score: {data.z}/100
          </p>
          <p className={`text-xs ${
            data.regime === 'trending' ? 'text-neon-turquoise' :
            data.regime === 'ranging' ? 'text-neon-yellow' :
            data.regime === 'volatile' ? 'text-neon-orange' :
            'text-neon-raspberry'
          }`}>
            Regime: {data.regime.charAt(0).toUpperCase() + data.regime.slice(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Volatility" 
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF' }}
            stroke="#6B7280"
            label={{ 
              value: 'Volatility', 
              position: 'bottom', 
              fill: '#9CA3AF',
              offset: 0
            }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Liquidity" 
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF' }}
            stroke="#6B7280"
            label={{ 
              value: 'Liquidity', 
              angle: -90, 
              position: 'left', 
              fill: '#9CA3AF',
              offset: 0
            }}
          />
          <ZAxis 
            type="number" 
            dataKey="z" 
            range={[20, 80]} 
            name="Risk Score" 
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter name="Asset Risk" data={chartData}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.z)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
