import { supabase } from './supabase';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { ErrorHandler } from './error-handler';
import { tradeGenerator } from './trade-generator';
import type { Database } from './supabase-types';

type Strategy = Database['public']['Tables']['strategies']['Row'];
type StrategyTrade = Database['public']['Tables']['strategy_trades']['Row'];

class MarketService extends EventEmitter {
  private activeMonitoring: Set<string> = new Set();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Any initialization logic here
      this.initialized = true;
      logService.log('info', 'Market service initialized', null, 'MarketService');
    } catch (error) {
      logService.log('error', 'Failed to initialize market service', error, 'MarketService');
      throw error;
    }
  }
  
  async startStrategyMonitoring(strategyId: string): Promise<void> {
    if (this.activeMonitoring.has(strategyId)) {
      // Already monitoring this strategy
      return;
    }
    
    try {
      // Fetch the strategy
      const { data: strategy, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();
        
      if (error) throw error;
      if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);
      
      // Update strategy status to active
      const { error: updateError } = await supabase
        .from('strategies')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', strategyId);
        
      if (updateError) throw updateError;
      
      // Set up monitoring
      this.activeMonitoring.add(strategyId);
      
      // Start periodic monitoring (every 1 minute)
      const interval = setInterval(() => this.checkForSignals(strategyId), 60000);
      this.monitoringIntervals.set(strategyId, interval);
      
      // Initial check for signals
      this.checkForSignals(strategyId);
      
      logService.log('info', `Started monitoring strategy: ${strategyId}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to start monitoring strategy: ${strategyId}`, error, 'MarketService');
      ErrorHandler.handleDatabaseError(error, 'startStrategyMonitoring');
    }
  }
  
  async stopStrategyMonitoring(strategyId: string): Promise<void> {
    if (!this.activeMonitoring.has(strategyId)) {
      // Not monitoring this strategy
      return;
    }
    
    try {
      // Clear interval
      const interval = this.monitoringIntervals.get(strategyId);
      if (interval) {
        clearInterval(interval);
        this.monitoringIntervals.delete(strategyId);
      }
      
      // Remove from active monitoring
      this.activeMonitoring.delete(strategyId);
      
      // Update strategy status in database
      const { error } = await supabase
        .from('strategies')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', strategyId);
        
      if (error) throw error;
      
      logService.log('info', `Stopped monitoring strategy: ${strategyId}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to stop monitoring strategy: ${strategyId}`, error, 'MarketService');
      ErrorHandler.handleDatabaseError(error, 'stopStrategyMonitoring');
    }
  }
  
  private async checkForSignals(strategyId: string): Promise<void> {
    try {
      //
