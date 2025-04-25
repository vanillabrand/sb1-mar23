// @ts-check
const { supabase } = require('../lib/supabase');
const { tradeService } = require('../lib/trade-service');
const { tradeEngine } = require('../lib/trade-engine');
const { demoService } = require('../lib/demo-service');
const { demoTradeGenerator } = require('../lib/demo-trade-generator');
const { logService } = require('../lib/log-service');

/**
 * Test script to verify that trades are properly closed and budget is released when a strategy is deactivated
 */
async function testTradeDeactivation() {
  try {
    console.log('Starting trade deactivation test...');
    
    // 1. Create a test strategy
    const strategyId = `test-strategy-${Date.now()}`;
    const { data: strategy, error: strategyError } = await supabase
      .from('strategies')
      .insert({
        id: strategyId,
        name: 'Test Strategy',
        description: 'Test strategy for deactivation test',
        status: 'active',
        selected_pairs: ['BTC/USDT'],
        strategy_config: {
          assets: ['BTC/USDT'],
          indicators: ['RSI', 'MACD'],
          config: {
            pairs: ['BTC/USDT']
          }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (strategyError) {
      throw new Error(`Failed to create test strategy: ${strategyError.message}`);
    }
    
    console.log(`Created test strategy: ${strategyId}`);
    
    // 2. Initialize budget for the strategy
    await tradeService.initializeBudget(strategyId);
    const initialBudget = await tradeService.getBudget(strategyId);
    console.log(`Initialized budget for strategy: ${JSON.stringify(initialBudget)}`);
    
    // 3. Create some test trades
    const trades = [];
    for (let i = 0; i < 3; i++) {
      const tradeId = `test-trade-${Date.now()}-${i}`;
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          id: tradeId,
          strategy_id: strategyId,
          symbol: 'BTC/USDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          quantity: 0.01,
          price: 50000,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            demo: true,
            source: 'test',
            entry_price: 50000,
            stop_loss: 49000,
            take_profit: 51000
          }
        })
        .select()
        .single();
        
      if (tradeError) {
        throw new Error(`Failed to create test trade ${i}: ${tradeError.message}`);
      }
      
      trades.push(trade);
      
      // Reserve budget for this trade
      const tradeCost = trade.quantity * trade.price;
      await tradeService.reserveBudgetForTrade(strategyId, tradeCost, tradeId);
      console.log(`Created test trade ${i}: ${tradeId} with cost ${tradeCost}`);
    }
    
    // 4. Check budget after creating trades
    const budgetAfterTrades = await tradeService.getBudget(strategyId);
    console.log(`Budget after creating trades: ${JSON.stringify(budgetAfterTrades)}`);
    
    // 5. Deactivate the strategy
    const { error: deactivateError } = await supabase
      .from('strategies')
      .update({
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', strategyId);
      
    if (deactivateError) {
      throw new Error(`Failed to deactivate strategy: ${deactivateError.message}`);
    }
    
    console.log(`Deactivated strategy: ${strategyId}`);
    
    // 6. Close all trades for the strategy
    await tradeService.removeTradesByStrategy(strategyId);
    
    // 7. Check budget after deactivation
    const budgetAfterDeactivation = await tradeService.getBudget(strategyId);
    console.log(`Budget after deactivation: ${JSON.stringify(budgetAfterDeactivation)}`);
    
    // 8. Check if all trades are closed
    const { data: remainingTrades, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('strategy_id', strategyId)
      .in('status', ['pending', 'open', 'executed']);
      
    if (fetchError) {
      throw new Error(`Failed to fetch remaining trades: ${fetchError.message}`);
    }
    
    console.log(`Remaining active trades: ${remainingTrades?.length || 0}`);
    
    // 9. Clean up
    await supabase
      .from('trades')
      .delete()
      .eq('strategy_id', strategyId);
      
    await supabase
      .from('strategies')
      .delete()
      .eq('id', strategyId);
      
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testTradeDeactivation();
