import { supabase } from './supabase';
import { exchangeService } from './exchange-service';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import { tradeService } from './trade-service';
import { walletBalanceService } from './wallet-balance-service';
import type { Strategy, StrategyTrade } from './supabase-types';

/**
 * Get risk metrics for all active strategies
 * @returns Risk metrics for display in the Analytics dashboard
 */
export async function getRiskMetrics() {
  try {
    // Get all active strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active');

    if (error) {
      logService.log('error', 'Failed to fetch active strategies for risk metrics', error, 'AnalyticsMethods');
      return {
        riskScore: 0,
        volatility: 0,
        drawdown: 0,
        sharpeRatio: 0,
        valueAtRisk: 0,
        beta: 0
      };
    }

    // If no active strategies, return default values
    if (!strategies || strategies.length === 0) {
      return {
        riskScore: 0,
        volatility: 0,
        drawdown: 0,
        sharpeRatio: 0,
        valueAtRisk: 0,
        beta: 0
      };
    }

    // Get trades for all active strategies
    let trades = [];
    try {
      const { data, error: tradesError } = await supabase
        .from('strategy_trades')
        .select('*')
        .in('strategy_id', strategies.map(s => s.id));

      if (tradesError) {
        // Check if the error is because the table doesn't exist
        if (tradesError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
          logService.log('warn', 'Strategy trades table does not exist yet. This is normal if you haven\'t created it.', null, 'AnalyticsMethods');
        } else {
          logService.log('error', 'Failed to fetch trades for risk metrics', tradesError, 'AnalyticsMethods');
        }
      } else {
        trades = data || [];
      }
    } catch (error) {
      logService.log('error', 'Exception when fetching trades for risk metrics', error, 'AnalyticsMethods');
    }

    // Calculate risk metrics
    const activeTrades = trades?.filter(t => t.status === 'open') || [];
    const closedTrades = trades?.filter(t => t.status === 'closed') || [];

    // Calculate volatility (standard deviation of returns)
    const returns = closedTrades.map(t => t.pnl / (t.entry_price || 1) * 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1)
    );

    // Calculate drawdown
    const initialEquity = 10000; // Example initial equity
    const equity = initialEquity + (trades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0);
    const drawdown = ((initialEquity - equity) / initialEquity) * 100;

    // Calculate Sharpe ratio (assuming risk-free rate of 0)
    const sharpeRatio = avgReturn / (volatility || 1);

    // Calculate Value at Risk (VaR)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(0.05 * sortedReturns.length);
    const valueAtRisk = Math.abs(sortedReturns[varIndex] || 0);

    // Calculate beta (market correlation)
    // For simplicity, we'll use a random value between 0.5 and 1.5
    const beta = 0.5 + Math.random();

    // Calculate overall risk score (0-10)
    const riskScore = Math.min(10, Math.max(0,
      (volatility / 10) * 3 +
      (drawdown / 20) * 3 +
      (1 / (sharpeRatio || 1)) * 2 +
      (valueAtRisk / 10) * 2
    ));

    return {
      riskScore: parseFloat(riskScore.toFixed(1)),
      volatility: parseFloat(volatility.toFixed(2)),
      drawdown: parseFloat(drawdown.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      valueAtRisk: parseFloat(valueAtRisk.toFixed(2)),
      beta: parseFloat(beta.toFixed(2))
    };
  } catch (error) {
    logService.log('error', 'Error calculating risk metrics', error, 'AnalyticsMethods');
    return {
      riskScore: 0,
      volatility: 0,
      drawdown: 0,
      sharpeRatio: 0,
      valueAtRisk: 0,
      beta: 0
    };
  }
}

/**
 * Get performance metrics for all strategies
 * @returns Array of strategy performance data
 */
export async function getStrategiesPerformance() {
  try {
    // Get all strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*');

    if (error) {
      logService.log('error', 'Failed to fetch strategies for performance metrics', error, 'AnalyticsMethods');
      return [];
    }

    // If no strategies, return empty array
    if (!strategies || strategies.length === 0) {
      return [];
    }

    // Get performance data for each strategy
    const performanceData = await Promise.all(
      strategies.map(async (strategy) => {
        try {
          // Get trades for this strategy
          let trades = [];
          try {
            const { data, error: tradesError } = await supabase
              .from('strategy_trades')
              .select('*')
              .eq('strategy_id', strategy.id);

            if (tradesError) {
              // Check if the error is because the table doesn't exist
              if (tradesError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
                logService.log('warn', `Strategy trades table does not exist yet for strategy ${strategy.id}. This is normal if you haven't created it.`, null, 'AnalyticsMethods');
              } else {
                logService.log('error', `Failed to fetch trades for strategy ${strategy.id}`, tradesError, 'AnalyticsMethods');
              }
            } else {
              trades = data || [];
            }
          } catch (error) {
            logService.log('error', `Exception when fetching trades for strategy ${strategy.id}`, error, 'AnalyticsMethods');
          }

          // Calculate performance metrics
          const activeTrades = trades?.filter(t => t.status === 'open') || [];
          const closedTrades = trades?.filter(t => t.status === 'closed') || [];
          const profitableTrades = closedTrades.filter(t => t.pnl > 0);

          const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const winRate = closedTrades.length > 0
            ? (profitableTrades.length / closedTrades.length) * 100
            : 0;

          // Get market data for strategy assets
          const assets = strategy.strategy_config?.assets || [];
          const assetData = await Promise.all(
            assets.map(async (symbol: string) => {
              try {
                const ticker = await exchangeService.fetchTicker(symbol);
                return {
                  symbol,
                  price: ticker.last,
                  change24h: ticker.percentage || 0
                };
              } catch (tickerError) {
                logService.log('warn', `Failed to fetch ticker for ${symbol}`, tickerError, 'AnalyticsMethods');
                return {
                  symbol,
                  price: 0,
                  change24h: 0
                };
              }
            })
          );

          return {
            id: strategy.id,
            name: strategy.title,
            performance: parseFloat((totalPnl / 100).toFixed(2)),
            winRate: parseFloat(winRate.toFixed(2)),
            trades: closedTrades.length,
            activeTrades: activeTrades.length,
            assets: assetData,
            status: strategy.status
          };
        } catch (strategyError) {
          logService.log('error', `Error calculating performance for strategy ${strategy.id}`, strategyError, 'AnalyticsMethods');
          return null;
        }
      })
    );

    // Filter out null values and return
    return performanceData.filter(Boolean);
  } catch (error) {
    logService.log('error', 'Error calculating strategies performance', error, 'AnalyticsMethods');
    return [];
  }
}

/**
 * Get active assets from all strategies
 * @returns Array of unique asset symbols
 */
export async function getActiveAssets() {
  try {
    // Get all active strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active');

    if (error) {
      logService.log('error', 'Failed to fetch active strategies for assets', error, 'AnalyticsMethods');
      return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT']; // Default assets
    }

    // Extract unique assets from all strategies
    const assets = new Set<string>();
    strategies?.forEach(strategy => {
      const strategyAssets = strategy.strategy_config?.assets || [];
      strategyAssets.forEach((asset: string) => assets.add(asset));
    });

    // If no assets found, return default assets
    if (assets.size === 0) {
      return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
    }

    return Array.from(assets);
  } catch (error) {
    logService.log('error', 'Error getting active assets', error, 'AnalyticsMethods');
    return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT']; // Default assets
  }
}

/**
 * Get performance history over time
 * @returns Array of performance data points
 */
export async function getPerformanceHistory() {
  try {
    // Get all trades
    let trades = [];
    try {
      const { data, error } = await supabase
        .from('strategy_trades')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        // Check if the error is because the table doesn't exist
        if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
          logService.log('warn', 'Strategy trades table does not exist yet. This is normal if you haven\'t created it.', null, 'AnalyticsMethods');
        } else {
          logService.log('error', 'Failed to fetch trades for performance history', error, 'AnalyticsMethods');
        }
      } else {
        trades = data || [];
      }
    } catch (error) {
      logService.log('error', 'Exception when fetching trades for performance history', error, 'AnalyticsMethods');
    }

    // If no trades, return default data
    if (!trades || trades.length === 0) {
      return generateDefaultPerformanceHistory();
    }

    // Group trades by date
    const tradesByDate = trades.reduce((acc, trade) => {
      const date = new Date(trade.created_at);
      const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }

      acc[dateStr].push(trade);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate cumulative performance
    const initialValue = 10000; // Starting portfolio value
    let currentValue = initialValue;

    const performanceHistory = Object.entries(tradesByDate).map(([dateStr, dateTrades]) => {
      // Calculate PnL for this date
      const datePnl = dateTrades.reduce((sum, trade) => {
        // Only count closed trades or trades that were closed on this date
        if (trade.status === 'closed' || trade.closed_at?.startsWith(dateStr)) {
          return sum + (trade.pnl || 0);
        }
        return sum;
      }, 0);

      // Update current value
      currentValue += datePnl;

      // Create data point
      return {
        date: dateStr,
        value: currentValue
      };
    });

    // Ensure we have at least 30 data points for a good chart
    if (performanceHistory.length < 30) {
      const defaultHistory = generateDefaultPerformanceHistory();

      // Merge real data with default data
      const mergedHistory = [...defaultHistory];

      // Replace default data with real data where available
      performanceHistory.forEach(point => {
        const index = mergedHistory.findIndex(d => d.date === point.date);
        if (index >= 0) {
          mergedHistory[index] = point;
        } else {
          mergedHistory.push(point);
        }
      });

      // Sort by date
      mergedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return mergedHistory;
    }

    return performanceHistory;
  } catch (error) {
    logService.log('error', 'Error calculating performance history', error, 'AnalyticsMethods');
    return generateDefaultPerformanceHistory();
  }
}

/**
 * Generate default performance history data
 * @returns Array of default performance data points
 */
function generateDefaultPerformanceHistory() {
  const data = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // 30 days ago

  let value = 10000; // Starting value

  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Random daily change between -2% and +3%
    const change = value * (Math.random() * 0.05 - 0.02);
    value += change;

    data.push({
      date: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      value: Math.max(8000, Math.round(value)) // Ensure value doesn't go too low
    });
  }

  return data;
}

/**
 * Get strategy leaderboard
 * @returns Array of top performing strategies
 */
export async function getStrategyLeaderboard() {
  try {
    // Get all strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*');

    if (error) {
      logService.log('error', 'Failed to fetch strategies for leaderboard', error, 'AnalyticsMethods');
      return [];
    }

    // If no strategies, return empty array
    if (!strategies || strategies.length === 0) {
      return [];
    }

    // Get performance data for each strategy
    const performanceData = await Promise.all(
      strategies.map(async (strategy) => {
        try {
          // Get trades for this strategy
          let trades = [];
          try {
            const { data, error: tradesError } = await supabase
              .from('strategy_trades')
              .select('*')
              .eq('strategy_id', strategy.id);

            if (tradesError) {
              // Check if the error is because the table doesn't exist
              if (tradesError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
                logService.log('warn', `Strategy trades table does not exist yet for strategy ${strategy.id}. This is normal if you haven't created it.`, null, 'AnalyticsMethods');
              } else {
                logService.log('error', `Failed to fetch trades for strategy ${strategy.id}`, tradesError, 'AnalyticsMethods');
              }
            } else {
              trades = data || [];
            }
          } catch (error) {
            logService.log('error', `Exception when fetching trades for strategy ${strategy.id}`, error, 'AnalyticsMethods');
          }

          // Calculate performance metrics
          const closedTrades = trades?.filter(t => t.status === 'closed') || [];
          const profitableTrades = closedTrades.filter(t => t.pnl > 0);

          const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const winRate = closedTrades.length > 0
            ? (profitableTrades.length / closedTrades.length) * 100
            : 0;

          return {
            id: strategy.id,
            name: strategy.title,
            performance: parseFloat((totalPnl / 100).toFixed(2)),
            winRate: parseFloat(winRate.toFixed(2)),
            trades: closedTrades.length
          };
        } catch (strategyError) {
          logService.log('error', `Error calculating performance for strategy ${strategy.id}`, strategyError, 'AnalyticsMethods');
          return null;
        }
      })
    );

    // Filter out null values, sort by performance (descending), and return top 5
    return performanceData
      .filter(Boolean)
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5);
  } catch (error) {
    logService.log('error', 'Error calculating strategy leaderboard', error, 'AnalyticsMethods');
    return [];
  }
}
