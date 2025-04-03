import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Loader2 } from 'lucide-react';
import type { Trade } from '../lib/types';

interface TradeChartProps {
  trades: Trade[];
}

export function TradeChart({ trades }: TradeChartProps) {
  if (!trades || trades.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  const chartData = trades.map(trade => ({
    timestamp: trade.timestamp,
    profit: trade.profit,
  }));

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#000000',
              border: 'none',
              borderRadius: '0.375rem',
              color: '#D1D5DB'
            }}
            labelStyle={{ color: '#9CA3AF' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Profit']}
            labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#2dd4bf"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#profitGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}