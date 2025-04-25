// Simple test script to verify trade deactivation
import { supabase } from '../lib/supabase.js';

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
    
    // 2. Create some test trades
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
      console.log(`Created test trade ${i}: ${tradeId}`);
    }
    
    // 3. Deactivate the strategy
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
    
    // 4. Check if all trades are closed
    const { data: remainingTrades, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('strategy_id', strategyId)
      .in('status', ['pending', 'open', 'executed']);
      
    if (fetchError) {
      throw new Error(`Failed to fetch remaining trades: ${fetchError.message}`);
    }
    
    console.log(`Remaining active trades: ${remainingTrades?.length || 0}`);
    
    // 5. Clean up
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
