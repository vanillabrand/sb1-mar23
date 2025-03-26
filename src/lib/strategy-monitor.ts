import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { tradeManager } from './trade-manager';
import { aiTradeService } from './ai-trade-service';
import { logService } from './log-service';
import type { Strategy } from './supabase-types';

class StrategyMonitor extends EventEmitter {
  private static instance: StrategyMonitor;
  private activeStrategies = new Map<string, Strategy>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private initialized = false;

  private constructor() {
    super();
    this.setupRealtimeSubscription();
  }

  static getInstance(): StrategyMonitor {
    if (!StrategyMonitor.instance) {
      StrategyMonitor.instance = new StrategyMonitor();
    }
    return StrategyMonitor.instance;
  }

  private setupRealtimeSubscription() {
    supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies' },
        this.handleStrategyChange.bind(this)
      )
      .subscribe();
  }

  private async handleStrategyChange(payload: any) {
    try {
      const strategy = payload.new as Strategy;
      const oldStrategy = payload.old as Strategy;

      if (!strategy || !strategy.id) return;

      // Handle status changes
      if (oldStrategy?.status !== strategy.status) {
        if (strategy.status === 'active') {
          await this.handleStrategyActivation(strategy);
        } else if (strategy.status === 'inactive') {
          await this.handleStrategyDeactivation(strategy);
        }
      }

      // Update active strategies map
      if (strategy.status === 'active') {
        this.activeStrategies.set(strategy.id, strategy);
      } else {
        this.activeStrategies.delete(strategy.id);
      }

      this.emit('strategyUpdate', strategy);
    } catch (error) {
      logService.log('error', 'Error handling strategy change', error, 'StrategyMonitor');
    }
  }

  private async handleStrategyActivation(strategy: Strategy) {
    try {
      logService.log('info', `Strategy ${strategy.id} activation started`, strategy, 'StrategyMonitor');
      
      // 1. Validate budget first
      const budget = await tradeService.getBudget(strategy.id);
      if (!budget || budget <= 0) {
        throw new Error('Strategy requires configured budget before activation');
      }

      // 2. Check market fit using AI
      const marketFitAnalysis = await aiTradeService.analyzeMarketFit(strategy);
      if (!marketFitAnalysis.isSuitable) {
        throw new Error(`Strategy not suitable for current market: ${marketFitAnalysis.reason}`);
      }

      // 3. Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);

      // 4. Start market monitoring
      await marketService.startStrategyMonitoring(strategy);

      // 5. Initialize trade monitoring
      await this.initializeTradeMonitoring(strategy);

      // 6. Generate initial trades if none exist
      const existingTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
      if (existingTrades.length === 0) {
        await this.generateTradesForStrategy(strategy);
      }

      // 7. Update strategy status in DB
      await supabase
        .from('strategies')
        .update({
          status: 'active',
          last_market_fit_check: new Date().toISOString(),
          market_fit_score: marketFitAnalysis.score,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategy.id);

      this.emit('strategyActivated', strategy);
      logService.log('info', `Strategy ${strategy.id} activated successfully`, strategy, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Error activating strategy ${strategy.id}`, error, 'StrategyMonitor');
      await this.handleActivationFailure(strategy.id, error);
      throw error;
    }
  }

  private async initializeTradeMonitoring(strategy: Strategy) {
    // Set up trade monitoring for the strategy
    await tradeManager.initializeStrategy(strategy);
    
    // Subscribe to trade events
    tradeManager.on(`trade:${strategy.id}`, async (trade) => {
      await this.handleTradeUpdate(strategy, trade);
    });
  }

  private async handleActivationFailure(strategyId: string, error: any) {
    try {
      // Cleanup any partial activation
      this.activeStrategies.delete(strategyId);
      await marketService.stopStrategyMonitoring(strategyId);
      await tradeService.setBudget(strategyId, null);
      
      // Update strategy status
      await supabase
        .from('strategies')
        .update({
          status: 'inactive',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
    } catch (cleanupError) {
      logService.log('error', `Error cleaning up failed activation for ${strategyId}`, cleanupError, 'StrategyMonitor');
    }
  }

  private async generateTradesForStrategy(strategy: Strategy) {
    try {
      logService.log('info', `Generating trades for strategy ${strategy.id}`, strategy, 'StrategyMonitor');
      
      // Get historical and current market data
      const marketData = await this.getStrategyMarketData(strategy);
      
      // Get available budget
      const budget = await tradeManager.getAvailableBudget(strategy.id);
      if (!budget || budget <= 0) {
        logService.log('warn', `No budget available for strategy ${strategy.id}`, null, 'StrategyMonitor');
        return;
      }

      // Generate trades using AI
      const trades = await aiTradeService.generateTrades(
        strategy,
        marketData,
        budget,
        { maxPositions: strategy.strategy_config?.maxPositions || 3 }
      );
      
      // Execute generated trades
      for (const trade of trades) {
        try {
          const executedTrade = await tradeManager.executeTrade(strategy, trade);
          this.emit('tradeExecuted', { strategy, trade: executedTrade });
        } catch (error) {
          logService.log('error', `Failed to execute trade for strategy ${strategy.id}`, error, 'StrategyMonitor');
        }
      }

      logService.log('info', `Generated ${trades.length} trades for strategy ${strategy.id}`, null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Error generating trades for strategy ${strategy.id}`, error, 'StrategyMonitor');
    }
  }

  private async getStrategyMarketData(strategy: Strategy) {
    const marketData = {
      assets: {} as Record<string, any>,
      marketConditions: await marketMonitor.getMarketConditions(),
      timestamp: new Date().toISOString()
    };

    for (const asset of (strategy.strategy_config?.assets || [])) {
      marketData.assets[asset] = {
        price: await marketMonitor.getCurrentPrice(asset),
        volume: await marketMonitor.get24hVolume(asset),
        historicalData: await marketMonitor.getHistoricalData(asset, 100),
        indicators: await marketMonitor.getIndicatorValues(asset, strategy.strategy_config?.indicators || [])
      };
    }

    return marketData;
  }

  private async checkMarketFit(strategy: Strategy) {
    try {
      const marketData = await this.getStrategyMarketData(strategy);
      const analysis = await aiTradeService.analyzeMarketFit(strategy, marketData);

      await supabase
        .from('strategies')
        .update({
          last_market_fit_check: new Date().toISOString(),
          market_fit_score: analysis.score,
          market_fit_details: analysis.details
        })
        .eq('id', strategy.id);

      if (!analysis.isSuitable) {
        logService.log('warn', `Strategy ${strategy.id} no longer fits market conditions`, analysis, 'StrategyMonitor');
        this.emit('strategyMarketFitWarning', { strategy, analysis });
      }

      return analysis;
    } catch (error) {
      logService.log('error', `Error checking market fit for strategy ${strategy.id}`, error, 'StrategyMonitor');
      throw error;
    }
  }

  private async handleStrategyDeactivation(strategy: Strategy) {
    try {
      logService.log('info', `Strategy ${strategy.id} deactivation started`, strategy, 'StrategyMonitor');
      
      // 1. Remove from active strategies first
      this.activeStrategies.delete(strategy.id);

      // 2. Close all open trades
      const trades = tradeManager.getActiveTradesForStrategy(strategy.id);
      for (const trade of trades) {
        await tradeManager.closeTrade(trade.id);
      }

      // 3. Stop market monitoring
      await marketService.stopStrategyMonitoring(strategy.id);

      // 4. Clear budget
      await tradeService.setBudget(strategy.id, null);

      // 5. Update strategy status
      await supabase
        .from('strategies')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', strategy.id);

      // 6. Cleanup trade monitoring
      tradeManager.removeAllListeners(`trade:${strategy.id}`);

      this.emit('strategyDeactivated', strategy);
      logService.log('info', `Strategy ${strategy.id} deactivated successfully`, strategy, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Error deactivating strategy ${strategy.id}`, error, 'StrategyMonitor');
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing strategy monitor', null, 'StrategyMonitor');

      // Load active strategies from database
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      // Initialize active strategies
      if (strategies) {
        for (const strategy of strategies) {
          await this.handleStrategyActivation(strategy);
        }
      }

      // Start polling
      this.startPolling();

      this.initialized = true;
      logService.log('info', 'Strategy monitor initialized successfully', null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy monitor', error, 'StrategyMonitor');
      throw error;
    }
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        // Check each active strategy
        for (const [strategyId, strategy] of this.activeStrategies) {
          // 1. Verify strategy is still active in database
          const { data } = await supabase
            .from('strategies')
            .select('status, last_market_fit_check')
            .eq('id', strategyId)
            .single();

          if (!data || data.status !== 'active') {
            await this.handleStrategyDeactivation(strategy);
            continue;
          }

          // 2. Check market fit periodically (every 4 hours)
          const lastCheck = new Date(data.last_market_fit_check || 0);
          if (Date.now() - lastCheck.getTime() > 4 * 60 * 60 * 1000) {
            const marketFit = await this.checkMarketFit(strategy);
            if (!marketFit.isSuitable) {
              // Optionally auto-deactivate if market fit is poor
              if (marketFit.score < strategy.strategy_config?.minMarketFitScore || 0.3) {
                await this.handleStrategyDeactivation(strategy);
                continue;
              }
            }
          }

          // 3. Check for trade opportunities
          const trades = tradeManager.getActiveTradesForStrategy(strategyId);
          if (trades.length === 0) {
            await this.generateTradesForStrategy(strategy);
          }

          // 4. Monitor existing trades
          await this.monitorStrategyConditions(strategy);
        }
      } catch (error) {
        logService.log('error', 'Error in strategy monitor polling', error, 'StrategyMonitor');
      }
    }, this.POLL_INTERVAL);

    logService.log('info', `Started strategy polling (${this.POLL_INTERVAL}ms interval)`, null, 'StrategyMonitor');
  }

  getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values());
  }

  isStrategyActive(strategyId: string): boolean {
    return this.activeStrategies.has(strategyId);
  }

  cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.activeStrategies.clear();
    this.initialized = false;
  }

  private async monitorStrategyConditions(strategy: Strategy) {
    try {
      if (!strategy.strategy_config?.assets) {
        throw new Error('Strategy has no configured assets');
      }

      const assetData = new Map();
      
      // Gather market data for all strategy assets
      for (const symbol of strategy.strategy_config.assets) {
        const ticker = await bitmartService.getTicker(symbol);
        const marketState = marketMonitor.getMarketState(symbol);
        const historicalData = marketMonitor.getHistoricalData(symbol, 100);
        
        assetData.set(symbol, {
          price: parseFloat(ticker.last_price),
          marketState,
          historicalData
        });
      }

      // Generate trades based on current conditions
      const trades = await aiTradeService.generateTrades(
        strategy,
        Array.from(assetData.values()),
        await tradeService.getBudget(strategy.id)
      );

      // Process generated trades
      if (trades && trades.length > 0) {
        for (const trade of trades) {
          const signal = {
            strategy,
            signal: {
              ...trade,
              entry: {
                price: trade.entry_price,
                type: 'market',
                amount: trade.entry.amount
              }
            }
          };

          // Emit trade opportunity
          this.emit('tradeOpportunity', signal);

          // Store trade signal
          await this.storeTrade(strategy.id, signal);
        }

        // Update UI
        this.emit('strategyUpdate', {
          strategyId: strategy.id,
          trades: trades,
          lastUpdate: new Date().toISOString()
        });
      }

    } catch (error) {
      logService.log('error', `Error monitoring strategy ${strategy.id}`, error, 'StrategyMonitor');
    }
  }

  private async storeTrade(strategyId: string, signal: any) {
    try {
      const { data: trade, error } = await supabase
        .from('strategy_trades')
        .insert({
          strategy_id: strategyId,
          symbol: signal.signal.symbol,
          direction: signal.signal.direction,
          entry_price: signal.signal.entry.price,
          amount: signal.signal.entry.amount,
          stop_loss: signal.signal.stopLoss,
          take_profit: signal.signal.takeProfit,
          status: 'pending',
          confidence: signal.signal.confidence,
          indicators: signal.signal.indicators,
          rationale: signal.signal.rationale
        })
        .select()
        .single();

      if (error) throw error;
      return trade;
    } catch (error) {
      logService.log('error', 'Failed to store trade', error, 'StrategyMonitor');
      throw error;
    }
  }
}

export const strategyMonitor = StrategyMonitor.getInstance();
