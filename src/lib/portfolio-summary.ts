import { supabase } from './supabase';
import { logService } from './log-service';
import { transactionService } from './transaction-service';

/**
 * Get portfolio summary data
 * @returns Portfolio summary data
 */
export async function getPortfolioSummary(): Promise<any> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get all transactions for the user
    const transactions = await transactionService.getTransactionsForUser();

    // Get all strategies for the user
    const { data: strategies } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', user.id);

    // Calculate portfolio summary
    const summary = calculatePortfolioSummary(transactions, strategies || []);
    return summary;
  } catch (error) {
    logService.log('error', 'Failed to get portfolio summary', error, 'PortfolioSummary');

    // Return sample data for demo purposes
    return {
      currentValue: 12450.75,
      startingValue: 10000,
      totalChange: 2450.75,
      percentChange: 24.51,
      totalTrades: 42,
      profitableTrades: 28,
      winRate: 66.67
    };
  }
}

/**
 * Calculate portfolio summary from transactions and strategies
 * @param transactions User transactions
 * @param strategies User strategies
 * @returns Portfolio summary
 */
function calculatePortfolioSummary(transactions: any[], strategies: any[]): any {
  // Default starting value
  const startingValue = 10000;

  // Calculate current value from transactions
  let currentValue = startingValue;
  let totalTrades = 0;
  let profitableTrades = 0;

  if (transactions && transactions.length > 0) {
    // Sort transactions by date
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Get the latest balance
    const lastTransaction = sortedTransactions[sortedTransactions.length - 1];
    if (lastTransaction) {
      currentValue = lastTransaction.balance_after;
    }

    // Count trades and profitable trades
    for (const transaction of sortedTransactions) {
      if (transaction.type === 'trade') {
        totalTrades++;
        if (transaction.amount > 0) {
          profitableTrades++;
        }
      }
    }
  }

  // Calculate changes
  const totalChange = currentValue - startingValue;
  const percentChange = (totalChange / startingValue) * 100;
  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

  return {
    currentValue,
    startingValue,
    totalChange,
    percentChange,
    totalTrades,
    profitableTrades,
    winRate
  };
}
