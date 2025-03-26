import { supabase } from './supabase-client';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { bitmartService } from './bitmart-service';
import { tradeManager } from './trade-manager';

class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private updateInterval: number = 5000; // 5 seconds

  private constructor() {
    super();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        logService.log('info', 'Initializing monitoring service', null, 'MonitoringService');
        
        // Subscribe to realtime updates
        supabase
          .channel('strategy_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'strategies' },
            this.handleStrategyChange.bind(this)
          )
          .subscribe();

        // Subscribe to monitoring status updates
        supabase
          .channel('monitoring_status_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'monitoring_status' },
            this.handleMonitoringStatusChange.bind(this)
          )
          .subscribe();

        this.initialized = true;
        logService.log('info', 'Monitoring service initialized successfully', null, 'MonitoringService');
      } catch (error) {
        logService.log('error', 'Failed to initialize monitoring service', error, 'MonitoringService');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  private handleStrategyChange(payload: any) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          this.emit('strategyCreated', newRecord);
          logService.log('info', `Strategy created: ${newRecord.name}`, { id: newRecord.id }, 'MonitoringService');
          break;
        case 'UPDATE':
          this.emit('strategyUpdated', newRecord);
          logService.log('info', `Strategy updated: ${newRecord.name}`, { id: newRecord.id }, 'MonitoringService');
          break;
        case 'DELETE':
          this.emit('strategyDeleted', oldRecord);
          logService.log('info', `Strategy deleted: ${oldRecord.name}`, { id: oldRecord.id }, 'MonitoringService');
          break;
      }
    } catch (error) {
      logService.log('error', 'Error handling strategy change', error, 'MonitoringService');
    }
  }

  private handleMonitoringStatusChange(payload: any) {
    try {
      const { eventType, new: newRecord } = payload;
      
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.emit('monitoringStatusUpdated', newRecord);
        logService.log('info', `Monitoring status updated for strategy ${newRecord.strategy_id}`, 
          { status: newRecord.status }, 'MonitoringService');
      }
    } catch (error) {
      logService.log('error', 'Error handling monitoring status change', error, 'MonitoringService');
    }
  }

  async updateMonitoringStatus(strategyId: string, status: {
    status: 'monitoring' | 'generating' | 'executing' | 'idle',
    message?: string,
    progress?: number,
    indicators?: any,
    conditions?: any,
    market_conditions?: any,
    next_check?: Date
  }): Promise<void> {
    try {
      // First check if a monitoring status exists for this strategy
      const { data: existingStatus, error: fetchError } = await supabase
        .from('monitoring_status')
        .select('id')
        .eq('strategy_id', strategyId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const now = new Date().toISOString();
      
      if (existingStatus) {
        // Update existing status
        const { error } = await supabase
          .from('monitoring_status')
          .update({
            status: status.status,
            message: status.message,
            progress: status.progress,
            indicators: status.indicators,
            conditions: status.conditions,
            market_conditions: status.market_conditions,
            last_check: now,
            next_check: status.next_check?.toISOString(),
            updated_at: now
          })
          .eq('strategy_id', strategyId);

        if (error) throw error;
      } else {
        // Create new status
        const { error } = await supabase
          .from('monitoring_status')
          .insert({
            strategy_id: strategyId,
            status: status.status,
            message: status.message,
            progress: status.progress,
            indicators: status.indicators,
            conditions: status.conditions,
            market_conditions: status.market_conditions,
            last_check: now,
            next_check: status.next_check?.toISOString()
          });

        if (error) throw error;
      }
      
      logService.log('info', `Updated monitoring status for strategy ${strategyId}`, 
        { status: status.status }, 'MonitoringService');
    } catch (error) {
      logService.log('error', 'Failed to update monitoring status', error, 'MonitoringService');
      throw error;
    }
  }

  async createStrategy(strategyData: any): Promise<string> {
    try {
      logService.log('info', 'Creating new strategy', { name: strategyData.name }, 'MonitoringService');
      
      // Ensure created_at and updated_at are set
      const now = new Date().toISOString();
      const dataWithTimestamps = {
        ...strategyData,
        created_at: now,
        updated_at: now
      };
      
      const { data, error } = await supabase
        .from('strategies')
        .insert(dataWithTimestamps)
        .select('id')
        .single();

      if (error) throw error;
      
      // Initialize monitoring status for new strategy
      await this.updateMonitoringStatus(data.id, { status: 'idle' });
      
      return data.id;
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'MonitoringService');
      throw error;
    }
  }

  async updateStrategy(id: string, strategyData: any): Promise<void> {
    try {
      logService.log('info', `Updating strategy ${id}`, { name: strategyData.name }, 'MonitoringService');
      
      // Ensure updated_at is set
      const dataWithTimestamp = {
        ...strategyData,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('strategies')
        .update(dataWithTimestamp)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logService.log('error', 'Failed to update strategy', error, 'MonitoringService');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    try {
      logService.log('info', `Deleting strategy ${id}`, null, 'MonitoringService');
      
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Monitoring status will be automatically deleted due to ON DELETE CASCADE
    } catch (error) {
      logService.log('error', 'Failed to delete strategy', error, 'MonitoringService');
      throw error;
    }
  }

  async copyStrategy(id: string): Promise<string> {
    try {
      logService.log('info', `Copying strategy ${id}`, null, 'MonitoringService');
      
      // Get the strategy to copy
      const { data: strategy, error: fetchError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy with a new name
      const now = new Date().toISOString();
      const newStrategy = {
        ...strategy,
        id: undefined, // Let Supabase generate a new ID
        name: `${strategy.name} (Copy)`,
        created_at: now,
        updated_at: now
      };

      // Insert the copy
      const { data: newData, error: insertError } = await supabase
        .from('strategies')
        .insert(newStrategy)
        .select('id')
        .single();

      if (insertError) throw insertError;
      
      // Initialize monitoring status for copied strategy
      await this.updateMonitoringStatus(newData.id, { status: 'idle' });
      
      return newData.id;
    } catch (error) {
      logService.log('error', 'Failed to copy strategy', error, 'MonitoringService');
      throw error;
    }
  }

  async getMonitoringStatus(strategyId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('monitoring_status')
        .select('*')
        .eq('strategy_id', strategyId)
        .maybeSingle();

      if (error) throw error;
      
      return data;
    } catch (error) {
      logService.log('error', 'Failed to get monitoring status', error, 'MonitoringService');
      throw error;
    }
  }

  async getAllMonitoringStatuses(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('monitoring_status')
        .select('*');

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to get all monitoring statuses', error, 'MonitoringService');
      throw error;
    }
  }

  async updateStrategyStatus(strategyId: string): Promise<DetailedMonitoringStatus> {
    try {
      // Get strategy configuration
      const strategy = await this.getStrategy(strategyId);
      
      // Get current market data
      const marketData = await bitmartService.getMarketData(strategy.symbol);
      
      // Calculate market metrics
      const marketMetrics = await this.calculateMarketMetrics(marketData);
      
      // Get current indicator values
      const indicators = await this.calculateIndicators(strategy, marketData);
      
      // Evaluate strategy conditions
      const conditions = await this.evaluateStrategyConditions(strategy, indicators);
      
      // Get active positions
      const positions = await this.getPositionDetails(strategy);
      
      const status: DetailedMonitoringStatus = {
        status: 'monitoring',
        message: 'Actively monitoring market conditions',
        timestamp: Date.now(),
        activeConditions: conditions,
        marketMetrics,
        positions,
        lastIndicatorValues: indicators,
        nextEvaluation: new Date(Date.now() + this.updateInterval).toISOString()
      };

      // Update status in database
      await this.saveMonitoringStatus(strategyId, status);
      
      return status;
    } catch (error) {
      logService.log('error', 'Failed to update strategy status', error, 'MonitoringService');
      throw error;
    }
  }

  private async calculateMarketMetrics(marketData: any): Promise<any> {
    const volatility = await this.calculateVolatility(marketData.klines);
    const trendStrength = await this.calculateTrendStrength(marketData.klines);
    
    return {
      volatility,
      volume24h: marketData.volume24h,
      priceChange24h: marketData.priceChange24h,
      trendStrength
    };
  }

  private async evaluateStrategyConditions(
    strategy: Strategy, 
    indicators: Record<string, number>
  ): Promise<StrategyCondition[]> {
    const conditions: StrategyCondition[] = [];
    
    for (const condition of strategy.strategy_config.conditions) {
      const currentValue = indicators[condition.indicator];
      const status = this.evaluateCondition(currentValue, condition);
      
      conditions.push({
        name: condition.name,
        currentValue,
        targetValue: condition.target,
        status,
        lastUpdated: new Date().toISOString()
      });
    }
    
    return conditions;
  }

  private async getPositionDetails(strategy: Strategy): Promise<TradePosition[]> {
    const positions = [];
    
    if (process.env.MODE === 'demo') {
      // Simulate position updates in demo mode
      const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
      
      for (const trade of activeTrades) {
        const currentPrice = await bitmartService.getCurrentPrice(trade.symbol);
        const unrealizedPnl = this.calculateUnrealizedPnl(trade, currentPrice);
        
        positions.push({
          entryPrice: trade.entryPrice,
          currentPrice,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          trailingStop: trade.trailingStop,
          size: trade.size,
          leverage: trade.leverage,
          unrealizedPnl: unrealizedPnl.amount,
          unrealizedPnlPercent: unrealizedPnl.percentage,
          timeOpen: trade.openTime
        });
      }
    } else {
      // Get real position data from exchange
      const exchangePositions = await bitmartService.getPositions(strategy.symbol);
      // Transform exchange positions to our format...
    }
    
    return positions;
  }

  private calculateUnrealizedPnl(trade: any, currentPrice: number) {
    const priceDiff = currentPrice - trade.entryPrice;
    const amount = priceDiff * trade.size * trade.leverage;
    const percentage = (priceDiff / trade.entryPrice) * 100 * trade.leverage;
    
    return { amount, percentage };
  }
}

export const monitoringService = MonitoringService.getInstance();
