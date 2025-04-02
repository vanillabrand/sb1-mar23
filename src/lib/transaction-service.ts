import { supabase } from './supabase';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
  id: string;
  user_id: string;
  strategy_id?: string;
  type: 'trade' | 'deposit' | 'withdrawal';
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
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

      const { data: transactions, error } = await supabase
        .from('transaction_history')  // Make sure this matches your actual table name
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        // Check if the error is because the transaction_history table doesn't exist
        if (error.message && error.message.includes('relation "transaction_history" does not exist')) {
          logService.log('warn', 'Transaction history table does not exist, returning empty array', null, 'TransactionService');
          console.warn('Transaction history table does not exist. Please run the database setup script.');
          return [];
        } else {
          logService.log('error', 'Supabase query error', error, 'TransactionService');
          throw error;
        }
      }

      return transactions || [];
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
    strategyId?: string
  ): Promise<Transaction> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const transaction: Partial<Transaction> = {
        id: uuidv4(),
        user_id: user.id,
        strategy_id: strategyId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceBefore + amount,
        description,
        status: 'completed'
      };

      const { data, error } = await supabase
        .from('transaction_history')
        .insert(transaction)
        .select()
        .single();

      if (error) {
        // Check if the error is because the transaction_history table doesn't exist
        if (error.message && error.message.includes('relation "transaction_history" does not exist')) {
          logService.log('warn', 'Transaction history table does not exist, skipping transaction recording', null, 'TransactionService');
          console.warn('Transaction history table does not exist. Please run the database setup script.');

          // Return a synthetic transaction object
          return {
            ...transaction,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Transaction;
        } else {
          throw error;
        }
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
