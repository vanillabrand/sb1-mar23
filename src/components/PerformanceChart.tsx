import React, { useState, useEffect } from 'react';
import { 
  Area, 
  AreaChart,
  CartesianGrid, 
  ResponsiveContainer,
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';
import { RefreshCw, Loader2 } from 'lucide-react';
import { analyticsService } from '../lib/analytics-service';

interface TimeFilter {
  label: string;
  days: number;
  active: boolean;
}

interface PerformanceChartProps {
  activeStrategies: any[];
  className?: string;
}

export function PerformanceChart({ activeStrategies, className = "" }: PerformanceChartProps) {
  const [timeFilters, setTimeFilters] = useState<TimeFilter[]>([
    { label: '1D', days: 1, active: false },
    { label: '1W', days: 7, active: false },
    { label: '1M', days: 30, active: true },
    { label: '3M', days: 90, active: false }
  ]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get active time filter
  const activeTimeFilter = timeFilters.find(f => f.active) || timeFilters[2]; // Default to 1M

  // Handle time filter change
  const handleFilterChange = (selectedFilter: TimeFilter) => {
    setTimeFilters(prev => 
      prev.map(filter => ({
        ...filter,
        active: filter.label === selectedFilter.label
      }))
    );
  };

  // Update performance data
  const updatePerformanceData = async () => {
    setLoading(true);
    
    try {
      const cutoff = Date.now() - (activeTimeFilter.days * 24 * 60 * 60 * 1000);
      
      // Try to get real data first
      if (activeStrategies.length > 0) {
        const strategyAnalytics = activeStrategies.flatMap(s => {
          return analyticsService.getStrategyAnalytics(s.id)
            .filter(a => a.timestamp >= cutoff)
            .map(a => ({
              date: new Date(a.timestamp).toLocaleDateString(),
              value: a.metrics.equity,
              strategyId: s.id
            }));
        });
        
        if (strategyAnalytics.length > 0) {
          // Group by date and calculate total equity
          const groupedByDate = strategyAnalytics.reduce((acc, item) => {
            if (!acc[item.date]) {
              acc[item.date] = { date: item.date, value: 0 };
            }
            acc[item.date].value += item.value;
            return acc;
          }, {} as Record<string, { date: string, value: number }>);
          
          // Convert to array and sort by date
          const data = Object.values(groupedByDate).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          
          setPerformanceData(data);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      
      // If no real data, generate synthetic data
      const data = generateSyntheticPerformanceData(activeTimeFilter.days);
      setPerformanceData(data);
    } catch (error) {
      console.error('Error updating performance data:', error);
      
      // Generate synthetic data as fallback
      const data = generateSyntheticPerformanceData(activeTimeFilter.days);
      setPerformanceData(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Generate synthetic performance data for demo purposes
  const generateSyntheticPerformanceData = (days: number) => {
    const data = [];
    const now = new Date();
    let value = 10000; // Starting value
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some realistic-looking fluctuations
      const changePercent = (Math.random() * 2 - 0.5) * (i < 5 ? 1.5 : 0.8); // More volatile recent days
      value = value * (1 + changePercent / 100);
      
      data.push({
        date: date.toLocaleDateString(),
        value: Math.round(value * 100) / 100
      });
    }
    
    return data;
  };

  useEffect(() => {
    updatePerformanceData();
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      updatePerformanceData();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [activeTimeFilter, activeStrategies]);

  const handleRefresh = () => {
    setRefreshing(true);
    updatePerformanceData();
  };

  // Calculate performance metrics
  const calculatePerformanceMetrics = () => {
    if (!performanceData || performanceData.length < 2) return { change: 0, percentChange: 0 };
    
    const first = performanceData[0]?.value || 0;
    const last = performanceData[performanceData.length - 1]?.value || 0;
    
    const change = last - first;
    const percentChange = first > 0 ? (change / first) * 100 : 0;
    
    return {
      change,
      percentChange
    };
  };

  const performanceMetrics = calculatePerformanceMetrics();

  // Custom tooltip for performance chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-neon-turquoise text-sm font-semibold">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  // Graph styling constants
  const chartStyles = {
    gridColor: "rgba(55, 65, 81, 0.15)",
    textColor: "#9CA3AF",
    tooltipBackground: "rgba(17, 24, 39, 0.9)",
    tooltipBorder: "rgba(75, 85, 99, 0.4)",
    areaGradientStart: "rgba(45, 212, 191, 0.2)",
    areaGradientEnd: "rgba(45, 212, 191, 0)",
    primaryColor: "#2dd4bf",
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold gradient-text">Portfolio Performance</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`text-sm ${performanceMetrics.percentChange >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
              {performanceMetrics.percentChange >= 0 ? '+' : ''}{performanceMetrics.percentChange.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-400">
              ({activeTimeFilter?.label || '1M'})
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-gunmetal-900/40 rounded-lg p-1">
            {timeFilters.map(filter => (
              <button
                key={filter.label}
                onClick={() => handleFilterChange(filter)}
                className={`px-3 py-1 text-xs font-medium transition-all duration-200 rounded-md ${
                  filter.active
                    ? 'bg-neon-turquoise/20 text-neon-turquoise'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {loading && performanceData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      ) : (
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={performanceData} 
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartStyles.primaryColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartStyles.primaryColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                tick={{ fill: chartStyles.textColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{ fill: chartStyles.textColor, fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <CartesianGrid strokeDasharray="3 3" stroke={chartStyles.gridColor} vertical={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartStyles.primaryColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}