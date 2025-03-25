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

  async getTransactionsForUser(
    startDate: number,
    endDate: number,
    type: 'all' | 'trade' | 'deposit' | 'withdrawal' = 'all'
  ): Promise<Transaction[]> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build query
      let query = supabase
        .from('transaction_history')
        .select()
        .eq('user_id', user.id)
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate).toISOString())
        .order('created_at', { ascending: false });

      // Add type filter if specified
      if (type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
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

      if (error) throw error;
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