import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { budgetHistoryService } from '../lib/budget-history-service';
import { logService } from '../lib/log-service';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BudgetHistoryChartProps {
  strategyId: string;
  days?: number;
  height?: number;
  showLegend?: boolean;
}

const BudgetHistoryChart: React.FC<BudgetHistoryChartProps> = ({
  strategyId,
  days = 30,
  height = 300,
  showLegend = true
}) => {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await budgetHistoryService.getBudgetHistorySummary(strategyId, days);
        setHistoryData(data);
        
        logService.log('info', `Loaded budget history data for strategy ${strategyId}`, 
          { entries: data.length }, 'BudgetHistoryChart');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load budget history: ${errorMessage}`);
        logService.log('error', `Failed to load budget history for strategy ${strategyId}`, 
          err, 'BudgetHistoryChart');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
    
    // Subscribe to budget history updates
    const handleHistoryUpdate = (data: any) => {
      if (data.strategyId === strategyId) {
        fetchHistoryData();
      }
    };
    
    window.addEventListener('budget:historyUpdated', handleHistoryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('budget:historyUpdated', handleHistoryUpdate as EventListener);
    };
  }, [strategyId, days]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = {
    labels: historyData.map(item => formatDate(item.date)),
    datasets: [
      {
        label: 'Total Budget',
        data: historyData.map(item => item.total),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2
      },
      {
        label: 'Available',
        data: historyData.map(item => item.available),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2
      },
      {
        label: 'Allocated',
        data: historyData.map(item => item.allocated),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 2
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          callback: function(value: any) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-400">Loading budget history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm p-4 bg-red-900/20 rounded-md">
        {error}
      </div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div className="text-gray-400 text-sm p-4 bg-gunmetal-800 rounded-md">
        No budget history data available for this strategy.
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default BudgetHistoryChart;
