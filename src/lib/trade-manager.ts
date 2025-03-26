import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { exchangeService } from './exchange-service';
import { tradeGenerator } from './trade-generator';
import { logService } from './log-service';
import { tradeService } from './trade-service';
import { v4 as uuidv4 } from 'uuid';
import type { Strategy, StrategyTrade } from './supabase-types';
import type { TradeConfig } from './types';

class TradeManager extends EventEmitter {
  private static instance: TradeManager;
  private activeTrades: Map<string, Map<string, StrategyTrade>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private initialized = false;
  private isUpdating = false;
  private readonly UPDATE_INTERVAL = 15000; // 15 seconds

  private constructor() {
    super();
    this.setupEventListeners();
  }

  static getInstance(): TradeManager {
    if (!TradeManager.instance) {
      TradeManager.instance = new TradeManager();
    }
    return TradeManager.instance;
  }

  private setupEventListeners() {
    tradeGenerator.on('tradeOpportunity', async ({ strategy, config, rationale }) => {
      try {
        logService.log('info', `Trade opportunity received for strategy ${strategy.id}`, {
          config,
          rationale
        }, 'TradeManager');
        
        await this.executeTrade(strategy, config);
      } catch (error) {
        logService.log('error', `Failed to execute trade for strategy ${strategy.id}`, error, 'TradeManager');
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing trade manager', null, 'TradeManager');
      
      // Load active trades from the database
      const { data: trades, error } = await supabase
        .from('strategy_trades')
        .select('*')
        .eq('status', 'open');

      if (error) throw error;

      if (trades) {
        trades.forEach(trade => {
          if (!this.activeTrades.has(trade.strategy_id)) {
            this.activeTrades.set(trade.strategy_id, new Map());
          }
          this.activeTrades.get(trade.strategy_id)?.set(trade.id, trade);
        });
        logService.log('info', `Loaded ${trades.length} active trades`, null, 'TradeManager');
      }

      // Start periodic updates
      this.startUpdateInterval();

      this.initialized = true;
      logService.log('info', 'Trade manager initialized successfully', null, 'TradeManager');
    } catch (error) {
      logService.log('error', 'Failed to initialize trade manager', error, 'TradeManager');
      throw error;
    }
  }

  private startUpdateInterval() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.updateActiveTrades();
    }, this.UPDATE_INTERVAL);
    
    logService.log('info', 'Started trade update interval', null, 'TradeManager');
  }

  private async updateActiveTrades() {
    if (this.isUpdating || this.activeTrades.size === 0) return;
    
    this.isUpdating = true;
    
    try {
      for (const [strategyId, trades] of this.activeTrades.entries()) {
        for (const trade of trades.values()) {
          try {
            const ticker = await exchangeService.fetchTicker(trade.pair);
            const currentPrice = parseFloat(ticker.last_price);
            
            // Calculate profit/loss and percentage
            const pnl = trade.type === 'Long' 
              ? (currentPrice - trade.entry_price) * trade.amount
              : (trade.entry_price - currentPrice) * trade.amount;
            const pnlPercent = (pnl / (trade.entry_price * trade.amount)) * 100;

            // Calculate trade duration
            const startDate = new Date(trade.created_at);
            const now = new Date();
            const durationMs = now.getTime() - startDate.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            const duration = `${hours}h ${minutes}m`;

            // Update trade record
            const { data: updatedTrade, error } = await supabase
              .from('strategy_trades')
              .update({
                current_price: currentPrice,
                pnl,
                pnl_percent: pnlPercent,
                duration,
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id)
              .select()
              .single();

            if (error) throw error;

            if (updatedTrade) {
              // Update local cache
              trades.set(updatedTrade.id, updatedTrade);
              
              // Emit update event
              this.emit('tradeExecuted', { 
                type: 'update', 
                trade: updatedTrade 
              });

              // Check stop loss and take profit conditions
              const strategy = await supabase
                .from('strategies')
                .select('*')
                .eq('id', strategyId)
                .single();

              if (strategy.data) {
                const stopLoss = strategy.data.strategy_config?.risk_management?.stop_loss || 2;
                const takeProfit = strategy.data.strategy_config?.risk_management?.take_profit || 6;

                if (pnlPercent <= -stopLoss || pnlPercent >= takeProfit) {
                  await this.closeTrade(trade.id);
                }
              }
            }
          } catch (error) {
            logService.log('warn', `Error updating trade ${trade.id}`, error, 'TradeManager');
          }
        }
      }
    } catch (error) {
      logService.log('error', 'Error in updateActiveTrades', error, 'TradeManager');
    } finally {
      this.isUpdating = false;
    }
  }

  async executeTrade(strategy: Strategy, config: TradeConfig): Promise<void> {
    try {
      // Create trade record first
      const trade = await this.createTradeRecord(strategy, config);
      
      // Get current price for the asset
      const ticker = await exchangeService.fetchTicker(config.symbol);
      const currentPrice = parseFloat(ticker.last_price);

      // Only execute order on exchange if in live mode AND not demo mode
      if (exchangeService.isLive() && !exchangeService.isDemoMode()) {
        try {
          await exchangeService.createOrder(
            config.symbol,
            'market',
            config.type === 'Long' ? 'buy' : 'sell',
            config.amount,
            currentPrice
          );
          logService.log('info', `Order executed on exchange for strategy ${strategy.id}`, {
            symbol: config.symbol,
            type: config.type,
            amount: config.amount,
            price: currentPrice
          }, 'TradeManager');
        } catch (orderError) {
          logService.log('error', 'Failed to execute order on exchange', orderError, 'TradeManager');
          // Continue processing since the trade record exists
        }
      } else {
        logService.log('info', `Simulated trade for strategy ${strategy.id} (demo mode)`, {
          symbol: config.symbol,
          type: config.type,
          amount: config.amount,
          price: currentPrice
        }, 'TradeManager');
      }
      
      // Add to active trades
      if (!this.activeTrades.has(strategy.id)) {
        this.activeTrades.set(strategy.id, new Map());
      }
      this.activeTrades.get(strategy.id)?.set(trade.id, trade);
      
      // Emit trade event
      this.emit('tradeExecuted', { 
        type: 'open', 
        trade,
        simulated: exchangeService.isDemoMode()
      });
    } catch (error) {
      logService.log('error', `Failed to execute trade for strategy ${strategy.id}`, error, 'TradeManager');
      throw error;
    }
  }

  async closeTrade(tradeId: string): Promise<void> {
    try {
      let foundTrade: StrategyTrade | undefined;
      let strategyId: string | undefined;

      // Find the trade in active trades
      for (const [sId, trades] of this.activeTrades.entries()) {
        if (trades.has(tradeId)) {
          foundTrade = trades.get(tradeId);
          strategyId = sId;
          break;
        }
      }

      if (!foundTrade || !strategyId) {
        throw new Error(`Trade ${tradeId} not found`);
      }

      // Close trade in database
      const { data: updatedTrade, error } = await supabase
        .from('strategy_trades')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;

      if (updatedTrade) {
        // Remove from active trades
        this.activeTrades.get(strategyId)?.delete(tradeId);
        if (this.activeTrades.get(strategyId)?.size === 0) {
          this.activeTrades.delete(strategyId);
        }
        
        // Emit close event
        this.emit('tradeExecuted', { 
          type: 'close', 
          trade: updatedTrade 
        });
        
        logService.log('info', `Closed trade ${tradeId} with P&L ${updatedTrade.pnl.toFixed(2)}`, updatedTrade, 'TradeManager');
      }
    } catch (error) {
      logService.log('error', `Failed to close trade ${tradeId}`, error, 'TradeManager');
      throw error;
    }
  }

  async getAvailableBudget(strategyId: string): Promise<number> {
    try {
      const budget = await tradeService.getBudget(strategyId);
      if (!budget) return 0;
      
      // Get active trades
      const activeTrades = this.getActiveTradesForStrategy(strategyId);
      
      // Calculate allocated amount
      const allocatedAmount = activeTrades.reduce((sum, trade) => {
        return sum + (trade.entry_price * trade.amount);
      }, 0);
      
      // Return available budget
      return Math.max(0, budget.available - allocatedAmount);
    } catch (error) {
      logService.log('error', `Error getting available budget for strategy ${strategyId}`, error, 'TradeManager');
      return 0;
    }
  }

  async initializeStrategy(strategy: Strategy): Promise<void> {
    try {
      logService.log('info', `Initializing trade manager for strategy ${strategy.id}`, null, 'TradeManager');
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      const { data: trades, error } = await supabase
        .from('strategy_trades')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('status', 'open');

      if (error) throw error;

      if (trades) {
        if (!this.activeTrades.has(strategy.id)) {
          this.activeTrades.set(strategy.id, new Map());
        }
        
        trades.forEach(trade => {
          this.activeTrades.get(strategy.id)?.set(trade.id, trade);
        });
        
        logService.log('info', `Loaded ${trades.length} active trades for strategy ${strategy.id}`, null, 'TradeManager');
      }
    } catch (error) {
      logService.log('error', `Failed to initialize trade manager for strategy ${strategy.id}`, error, 'TradeManager');
      throw error;
    }
  }

  getActiveTradesForStrategy(strategyId: string): StrategyTrade[] {
    const strategyTrades = this.activeTrades.get(strategyId);
    return strategyTrades ? Array.from(strategyTrades.values()) : [];
  }

  getActiveTradesGroupedByStrategy(): Map<string, StrategyTrade[]> {
    const groupedTrades = new Map<string, StrategyTrade[]>();
    this.activeTrades.forEach((trades, strategyId) => {
      groupedTrades.set(strategyId, Array.from(trades.values()));
    });
    return groupedTrades;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.activeTrades.clear();
    this.initialized = false;
    this.isUpdating = false;
  }

  async updateTradeStops(tradeId: string, stops: { stopLoss?: number; takeProfit?: number }): Promise<void> {
    try {
      let foundTrade: StrategyTrade | undefined;
      let strategyId: string | undefined;

      // Find the trade in active trades
      for (const [sId, trades] of this.activeTrades.entries()) {
        if (trades.has(tradeId)) {
          foundTrade = trades.get(tradeId);
          strategyId = sId;
          break;
        }
      }

      if (!foundTrade || !strategyId) {
        throw new Error(`Trade ${tradeId} not found`);
      }

      // Update trade stops in database
      const { data: updatedTrade, error } = await supabase
        .from('strategy_trades')
        .update({
          stop_loss: stops.stopLoss ?? foundTrade.stop_loss,
          take_profit: stops.takeProfit ?? foundTrade.take_profit,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;

      if (updatedTrade) {
        // Update local cache
        this.activeTrades.get(strategyId)?.set(tradeId, updatedTrade);
        
        // Emit update event
        this.emit('tradeExecuted', { 
          type: 'update', 
          trade: updatedTrade 
        });
        
        logService.log('info', `Updated stops for trade ${tradeId}`, { stops }, 'TradeManager');
      }
    } catch (error) {
      logService.log('error', `Failed to update stops for trade ${tradeId}`, error, 'TradeManager');
      throw error;
    }
  }
}

export const tradeManager = TradeManager.getInstance();
