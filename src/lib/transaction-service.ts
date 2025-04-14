import { supabase } from './supabase';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
  id: string;
  user_id: string;
  reference_id?: string; // Can be strategy_id or trade_id
  reference_type?: string; // 'strategy' or 'trade'
  type: 'trade' | 'deposit' | 'withdrawal';
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: Record<string, any>; // Additional data like strategy details
  created_at: string;
  updated_at: string;
}

class TransactionService extends EventEmitter {
  private static instance: TransactionService;
  private transactions = new Map<string, Transaction[]>();
  private initialized = false;

  private constructor() {
    super();
  }

  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing transaction service', null, 'TransactionService');

      // Subscribe to realtime updates
      supabase
        .channel('transaction_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transaction_history' },
          this.handleRealtimeUpdate.bind(this)
        )
        .subscribe();

      this.initialized = true;
      logService.log('info', 'Transaction service initialized', null, 'TransactionService');
    } catch (error) {
      logService.log('error', 'Failed to initialize transaction service', error, 'TransactionService');
      throw error;
    }
  }

  private handleRealtimeUpdate(payload: any) {
    try {
      const userId = payload.new?.user_id;
      if (!userId) return;

      const userTransactions = this.transactions.get(userId) || [];

      switch (payload.eventType) {
        case 'INSERT':
          userTransactions.unshift(payload.new);
          break;
        case 'UPDATE':
          const index = userTransactions.findIndex(t => t.id === payload.new.id);
          if (index >= 0) {
            userTransactions[index] = payload.new;
          }
          break;
        case 'DELETE':
          const deleteIndex = userTransactions.findIndex(t => t.id === payload.old.id);
          if (deleteIndex >= 0) {
            userTransactions.splice(deleteIndex, 1);
          }
          break;
      }

      this.transactions.set(userId, userTransactions);
      this.emit('transactionsUpdated', { userId, transactions: userTransactions });
    } catch (error) {
      logService.log('error', 'Error handling realtime update', error, 'TransactionService');
    }
  }

  async getTransactionsForUser(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    try {
      // Ensure valid date range
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000)); // Default to last 30 days

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date range');
      }

      // Try to get transactions from the transactions table first
      try {
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          // Check if the error is because the transactions table doesn't exist
          if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Transactions table does not exist, trying transaction_history table', null, 'TransactionService');

            // Try transaction_history table as fallback
            const { data: historyTransactions, error: historyError } = await supabase
              .from('transaction_history')
              .select('*')
              .gte('created_at', start.toISOString())
              .lte('created_at', end.toISOString())
              .order('created_at', { ascending: false });

            if (historyError) {
              // Both tables don't exist or other error
              if (historyError.code === '42P01') {
                logService.log('warn', 'Neither transactions nor transaction_history tables exist, returning empty array', null, 'TransactionService');
                console.warn('Transaction tables do not exist. Please run the database setup script.');
                return [];
              } else {
                logService.log('error', 'Supabase query error on transaction_history', historyError, 'TransactionService');
                throw historyError;
              }
            }

            return historyTransactions || [];
          } else {
            logService.log('error', 'Supabase query error on transactions', error, 'TransactionService');
            throw error;
          }
        }

        return transactions || [];
      } catch (queryError) {
        logService.log('error', 'Exception when querying transactions', queryError, 'TransactionService');
        return [];
      }
    } catch (error) {
      logService.log('error', 'Failed to get transactions', error, 'TransactionService');
      return [];
    }
  }

  async recordTransaction(
    type: Transaction['type'],
    amount: number,
    balanceBefore: number,
    description?: string,
    referenceId?: string,
    referenceType?: 'strategy' | 'trade',
    metadata?: Record<string, any>
  ): Promise<Transaction> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const transaction: Partial<Transaction> = {
        id: uuidv4(),
        user_id: user.id,
        reference_id: referenceId,
        reference_type: referenceType,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceBefore + amount,
        description,
        status: 'completed',
        metadata: metadata || {}
      };

      // Try to insert into transactions table first
      let data;
      try {
        const result = await supabase
          .from('transactions')
          .insert(transaction)
          .select()
          .single();

        if (result.error) {
          // Check if the error is because the transactions table doesn't exist
          if (result.error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Transactions table does not exist, trying transaction_history table', null, 'TransactionService');

            // Try transaction_history table as fallback
            const historyResult = await supabase
              .from('transaction_history')
              .insert(transaction)
              .select()
              .single();

            if (historyResult.error) {
              // Both tables don't exist or other error
              if (historyResult.error.code === '42P01') {
                logService.log('warn', 'Neither transactions nor transaction_history tables exist, skipping transaction recording', null, 'TransactionService');
                console.warn('Transaction tables do not exist. Please run the database setup script.');

                // Return a synthetic transaction object
                return {
                  ...transaction,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                } as Transaction;
              } else {
                throw historyResult.error;
              }
            } else {
              data = historyResult.data;
            }
          } else {
            throw result.error;
          }
        } else {
          data = result.data;
        }
      } catch (insertError) {
        logService.log('error', 'Failed to record transaction', insertError, 'TransactionService');

        // Return a synthetic transaction object as fallback
        return {
          ...transaction,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Transaction;
      }
      if (!data) throw new Error('Failed to create transaction');

      // Update local cache
      const userTransactions = this.transactions.get(user.id) || [];
      userTransactions.unshift(data);
      this.transactions.set(user.id, userTransactions);

      logService.log('info', `Recorded ${type} transaction for user ${user.id}`, transaction, 'TransactionService');
      return data;
    } catch (error) {
      logService.log('error', 'Failed to record transaction', error, 'TransactionService');
      throw error;
    }
  }

  cleanup() {
    this.transactions.clear();
    this.initialized = false;
  }
}

export const transactionService = TransactionService.getInstance();
