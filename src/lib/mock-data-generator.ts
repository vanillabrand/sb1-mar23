import { v4 as uuidv4 } from 'uuid';

// Define types
interface MockTrade {
  id: string;
  symbol: string;
  type: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed' | 'pending' | 'cancelled';
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  profit?: number;
  timestamp: number;
  closedAt?: number;
  strategyId: string;
}

/**
 * Generate mock trades for demo purposes
 * @param count Number of trades to generate
 * @param strategyId Optional strategy ID to associate with trades
 * @returns Array of mock trades
 */
export function generateMockTrades(count: number = 20, strategyId?: string): MockTrade[] {
  const trades: MockTrade[] = [];
  const now = Date.now();
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
  const types = ['market', 'limit'];
  const sides = ['buy', 'sell'] as const;
  const statuses = ['open', 'closed', 'pending', 'cancelled'] as const;

  // Generate random trades
  for (let i = 0; i < count; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    // Generate realistic prices based on the symbol
    let basePrice = 1;
    if (symbol.includes('BTC')) basePrice = 50000 + (Math.random() * 5000 - 2500);
    if (symbol.includes('ETH')) basePrice = 3000 + (Math.random() * 300 - 150);
    if (symbol.includes('SOL')) basePrice = 100 + (Math.random() * 20 - 10);
    if (symbol.includes('BNB')) basePrice = 500 + (Math.random() * 50 - 25);
    if (symbol.includes('XRP')) basePrice = 0.5 + (Math.random() * 0.1 - 0.05);

    const entryPrice = basePrice;
    const amount = Math.random() * 10;

    // For closed trades, generate exit price and profit
    let exitPrice, profit, closedAt;
    if (status === 'closed') {
      // Generate a price movement of -5% to +10%
      const priceChange = basePrice * (Math.random() * 0.15 - 0.05);
      exitPrice = basePrice + priceChange;

      // Calculate profit based on side (buy/sell)
      if (side === 'buy') {
        profit = (exitPrice - entryPrice) * amount;
      } else {
        profit = (entryPrice - exitPrice) * amount;
      }

      // Set closed timestamp to be after the entry timestamp
      closedAt = now - Math.floor(Math.random() * 1000000);
    }

    // Create the trade object with a guaranteed unique ID
    const trade: MockTrade = {
      id: `${uuidv4()}-${Date.now()}-${i}`,
      symbol,
      type,
      side,
      status,
      entryPrice,
      amount,
      timestamp: now - Math.floor(Math.random() * 2000000),
      strategyId: strategyId || uuidv4()
    };

    // Add closed trade specific fields
    if (status === 'closed') {
      trade.exitPrice = exitPrice;
      trade.profit = profit;
      trade.closedAt = closedAt;
    }

    trades.push(trade);
  }

  // Sort by timestamp (newest first)
  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Generate mock trade statistics
 * @param trades Array of trades to calculate statistics for
 * @returns Object with trade statistics
 */
export function generateMockTradeStats(trades: MockTrade[]) {
  const totalTrades = trades.length;
  const profitableTrades = trades.filter(t => (t.profit || 0) > 0).length;
  const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
  const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

  return {
    totalTrades,
    profitableTrades,
    totalProfit,
    averageProfit
  };
}
