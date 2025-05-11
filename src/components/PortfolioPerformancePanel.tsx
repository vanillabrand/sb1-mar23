import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Activity } from 'lucide-react';
import { portfolioPerformanceService } from '../lib/portfolio-performance-service';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
// Import from our centralized chart initialization module
import { ChartJSLine as Line } from '../lib/chart-init';

interface PortfolioPerformancePanelProps {
  className?: string;
}

export const PortfolioPerformancePanel: React.FC<PortfolioPerformancePanelProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [performance, setPerformance] = useState(portfolioPerformanceService.getPerformance());
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef(null);

  // Initialize and load performance data
  useEffect(() => {
    try {
      setIsLoading(true);

      // Get initial performance data
      const initialPerformance = portfolioPerformanceService.getPerformance();

      // Validate the performance data structure
      if (!initialPerformance || !initialPerformance.aggregated) {
        logService.log('warn', 'Invalid performance data structure, resetting',
          { initialPerformance }, 'PortfolioPerformancePanel');

        // Reset the performance data with skipEvent=true to prevent recursion
        portfolioPerformanceService.resetPerformance(true);

        // Get the reset performance data
        const resetPerformance = portfolioPerformanceService.getPerformance();
        setPerformance(resetPerformance);
        updateChartData(resetPerformance, activeTab);
      } else {
        setPerformance(initialPerformance);
        updateChartData(initialPerformance, activeTab);
      }

      // Subscribe to performance updates
      const handlePerformanceUpdate = (event: any) => {
        try {
          if (event && event.performance) {
            setPerformance(event.performance);
            updateChartData(event.performance, activeTab);
          }
        } catch (error) {
          logService.log('error', 'Error handling performance update', error, 'PortfolioPerformancePanel');
        }
      };

      portfolioPerformanceService.on('performanceUpdated', handlePerformanceUpdate);
      eventBus.subscribe('portfolio:performance:updated', handlePerformanceUpdate);

      // Generate demo data if in demo mode and no data exists
      if (demoService.isInDemoMode()) {
        try {
          const hasData = initialPerformance &&
                         initialPerformance.aggregated &&
                         initialPerformance.aggregated.dataPoints &&
                         initialPerformance.aggregated.dataPoints.length > 0;

          if (!hasData) {
            // Use setTimeout to avoid potential recursion issues
            setTimeout(() => {
              try {
                portfolioPerformanceService.generateDemoData();
              } catch (error) {
                logService.log('error', 'Error generating demo data', error, 'PortfolioPerformancePanel');
              }
            }, 100);
          }
        } catch (error) {
          logService.log('error', 'Error checking for demo data', error, 'PortfolioPerformancePanel');
        }
      }

      setIsLoading(false);
    } catch (error) {
      logService.log('error', 'Error initializing portfolio performance panel', error, 'PortfolioPerformancePanel');
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      try {
        portfolioPerformanceService.off('performanceUpdated', () => {});
        eventBus.unsubscribe('portfolio:performance:updated', () => {});
      } catch (error) {
        logService.log('error', 'Error cleaning up portfolio performance panel', error, 'PortfolioPerformancePanel');
      }
    };
  }, []);

  // Update chart data when active tab changes
  useEffect(() => {
    updateChartData(performance, activeTab);
  }, [activeTab, performance]);

  // Function to update chart data based on selected market type
  const updateChartData = (performanceData: any, marketType: string) => {
    if (!performanceData) {
      logService.log('warn', 'No performance data provided to updateChartData', null, 'PortfolioPerformancePanel');
      setChartData(null);
      return;
    }

    try {
      // Validate performance data structure
      if (!performanceData.aggregated || !performanceData.spot || !performanceData.margin || !performanceData.futures) {
        logService.log('warn', 'Invalid performance data structure in updateChartData',
          { performanceData }, 'PortfolioPerformancePanel');
        setChartData(null);
        return;
      }

      let dataSource;

      if (marketType === 'all') {
        dataSource = performanceData.aggregated;
      } else if (['spot', 'margin', 'futures'].includes(marketType)) {
        dataSource = performanceData[marketType];
      } else {
        logService.log('warn', `Unknown market type: ${marketType}, defaulting to aggregated`,
          null, 'PortfolioPerformancePanel');
        dataSource = performanceData.aggregated;
        // Update the active tab to match
        setActiveTab('all');
      }

      if (!dataSource || !dataSource.dataPoints || !Array.isArray(dataSource.dataPoints) || dataSource.dataPoints.length === 0) {
        logService.log('info', `No data points for market type: ${marketType}`,
          { dataSource }, 'PortfolioPerformancePanel');
        setChartData(null);
        return;
      }

      // Make a defensive copy of the data points
      const dataPointsCopy = dataSource.dataPoints.map(point => ({
        timestamp: point.timestamp || Date.now(),
        value: typeof point.value === 'number' ? point.value : 0,
        profit: typeof point.profit === 'number' ? point.profit : 0,
        trades: typeof point.trades === 'number' ? point.trades : 0
      }));

      // Sort data points by timestamp
      const sortedDataPoints = dataPointsCopy.sort((a, b) => a.timestamp - b.timestamp);

      // Format dates for labels
      const labels = sortedDataPoints.map(point => {
        try {
          const date = new Date(point.timestamp);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        } catch (error) {
          return 'Invalid Date';
        }
      });

      // Get values for the chart
      const values = sortedDataPoints.map(point => point.value);

      // Determine chart color based on performance trend
      const lastValue = values[values.length - 1] || 0;
      const isPositive = lastValue >= 0;

      // Create chart data
      const newChartData = {
        labels,
        datasets: [
          {
            label: `${marketType === 'all' ? 'Overall' : marketType.charAt(0).toUpperCase() + marketType.slice(1)} Performance`,
            data: values,
            borderColor: isPositive ? 'rgba(0, 255, 179, 1)' : 'rgba(255, 105, 180, 1)',
            backgroundColor: isPositive
              ? 'rgba(0, 255, 179, 0.1)'
              : 'rgba(255, 105, 180, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.4,
            fill: true
          }
        ]
      };

      setChartData(newChartData);
    } catch (error) {
      logService.log('error', 'Failed to update chart data', error, 'PortfolioPerformancePanel');
      setChartData(null);
    }
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `Value: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: {
            size: 10
          },
          maxRotation: 0
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: {
            size: 10
          },
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    animation: {
      duration: 1000
    }
  };

  // Get performance metrics for the active tab
  const getPerformanceMetrics = () => {
    try {
      if (!performance) return { totalProfit: 0, totalTrades: 0 };

      // Validate performance data structure
      if (!performance.aggregated || !performance.spot || !performance.margin || !performance.futures) {
        logService.log('warn', 'Invalid performance data structure in getPerformanceMetrics',
          { performance }, 'PortfolioPerformancePanel');
        return { totalProfit: 0, totalTrades: 0 };
      }

      if (activeTab === 'all') {
        const totalProfit = typeof performance.aggregated.totalProfit === 'number'
          ? performance.aggregated.totalProfit
          : 0;

        const totalTrades = typeof performance.aggregated.totalTrades === 'number'
          ? performance.aggregated.totalTrades
          : 0;

        return { totalProfit, totalTrades };
      }

      if (['spot', 'margin', 'futures'].includes(activeTab) && performance[activeTab]) {
        const totalProfit = typeof performance[activeTab].totalProfit === 'number'
          ? performance[activeTab].totalProfit
          : 0;

        const totalTrades = typeof performance[activeTab].totalTrades === 'number'
          ? performance[activeTab].totalTrades
          : 0;

        return { totalProfit, totalTrades };
      }

      // Default to aggregated if the active tab is invalid
      return {
        totalProfit: typeof performance.aggregated.totalProfit === 'number'
          ? performance.aggregated.totalProfit
          : 0,
        totalTrades: typeof performance.aggregated.totalTrades === 'number'
          ? performance.aggregated.totalTrades
          : 0
      };
    } catch (error) {
      logService.log('error', 'Error getting performance metrics', error, 'PortfolioPerformancePanel');
      return { totalProfit: 0, totalTrades: 0 };
    }
  };

  const { totalProfit, totalTrades } = getPerformanceMetrics();
  const isPositiveProfit = totalProfit >= 0;

  return (
    <div className={`bg-gunmetal-900/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-turquoise" />
          Portfolio Performance
        </h3>

        <div className="flex items-center gap-1 text-xs">
          {isPositiveProfit ? (
            <TrendingUp className="w-3 h-3 text-green-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span className={isPositiveProfit ? 'text-green-400' : 'text-red-400'}>
            {isPositiveProfit ? '+' : ''}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </span>
        </div>
      </div>

      {/* Market Type Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gunmetal-800 pb-2">
        <button
          className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 ${
            activeTab === 'all' ? 'bg-neon-turquoise/10 text-neon-turquoise' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('all')}
        >
          <PieChart className="w-3 h-3" />
          All
        </button>
        <button
          className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 ${
            activeTab === 'spot' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('spot')}
        >
          <BarChart3 className="w-3 h-3" />
          Spot
        </button>
        <button
          className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 ${
            activeTab === 'margin' ? 'bg-yellow-500/10 text-yellow-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('margin')}
        >
          <BarChart3 className="w-3 h-3" />
          Margin
        </button>
        <button
          className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 ${
            activeTab === 'futures' ? 'bg-pink-500/10 text-pink-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('futures')}
        >
          <BarChart3 className="w-3 h-3" />
          Futures
        </button>
      </div>

      {/* Performance Chart */}
      <div className="h-48 mb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-400 text-xs">Loading performance data...</div>
          </div>
        ) : chartData ? (
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-gray-400 text-xs mb-2">No performance data available</div>
            {demoService.isInDemoMode() && (
              <button
                className="text-xs bg-neon-turquoise/20 text-neon-turquoise px-3 py-1 rounded-md hover:bg-neon-turquoise/30"
                onClick={() => portfolioPerformanceService.generateDemoData()}
              >
                Generate Demo Data
              </button>
            )}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gunmetal-800/50 rounded-md p-3">
          <div className="text-xs text-gray-400 mb-1">Total Profit/Loss</div>
          <div className={`text-base font-medium ${isPositiveProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isPositiveProfit ? '+' : ''}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </div>
        </div>
        <div className="bg-gunmetal-800/50 rounded-md p-3">
          <div className="text-xs text-gray-400 mb-1">Total Trades</div>
          <div className="text-base font-medium text-white">
            {totalTrades.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPerformancePanel;
