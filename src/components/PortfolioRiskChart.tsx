import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Strategy, MarketAnalysis } from '../lib/types';

interface PortfolioRiskChartProps {
  strategies: Strategy[];
  marketAnalyses: Record<string, MarketAnalysis>;
}

export const PortfolioRiskChart: React.FC<PortfolioRiskChartProps> = ({
  strategies,
  marketAnalyses
}) => {
  // Get color based on risk level
  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'Ultra Low':
        return '#10b981'; // Green
      case 'Low':
        return '#34d399'; // Light Green
      case 'Medium':
        return '#facc15'; // Yellow
      case 'High':
        return '#fb923c'; // Orange
      case 'Ultra High':
        return '#f87171'; // Light Red
      case 'Extreme':
        return '#ef4444'; // Red
      case 'God Mode':
        return '#FF1493'; // Raspberry
      default:
        return '#6b7280'; // Gray
    }
  };

  // Calculate risk distribution data
  const riskData = useMemo(() => {
    if (!strategies || strategies.length === 0) {
      return [
        { name: 'No Data', value: 100, color: '#374151' }
      ];
    }

    // Group strategies by risk level
    const riskGroups: Record<string, number> = {};
    let totalBudget = 0;

    strategies.forEach(strategy => {
      const budget = strategy.budget?.total || 1000; // Default budget if not set
      totalBudget += budget;

      const riskLevel = strategy.riskLevel || 'Medium';
      if (!riskGroups[riskLevel]) {
        riskGroups[riskLevel] = 0;
      }
      riskGroups[riskLevel] += budget;
    });

    // Convert to chart data format
    return Object.entries(riskGroups).map(([level, budget]) => ({
      name: level,
      value: budget,
      percentage: (budget / totalBudget) * 100,
      color: getRiskLevelColor(level)
    }));
  }, [strategies]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm font-bold mb-1">{data.name}</p>
          <p className="text-neon-turquoise text-sm">
            ${data.value.toLocaleString()}
          </p>
          <p className="text-gray-400 text-xs">
            {data.percentage.toFixed(1)}% of portfolio
          </p>
        </div>
      );
    }
    return null;
  };

  // If no strategies, show empty state
  if (!strategies || strategies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No active strategies to display
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={riskData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
            labelLine={false}
          >
            {riskData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-gray-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
