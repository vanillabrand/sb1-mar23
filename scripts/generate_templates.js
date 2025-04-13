// Script to manually generate template strategies
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function generateTemplates() {
  try {
    console.log('Generating template strategies...');

    // Create demo templates
    const templates = createDemoTemplates();
    
    console.log(`Created ${templates.length} demo templates`);
    
    // Insert templates into database
    const { data, error } = await supabase
      .from('strategy_templates')
      .insert(templates);
      
    if (error) {
      console.error('Error inserting templates:', error);
      return;
    }
    
    console.log('Successfully inserted templates');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

function createDemoTemplates() {
  const templates = [];
  const riskLevels = ['Ultra Low', 'Low', 'Medium', 'High', 'Ultra High', 'Extreme'];
  const names = [
    'Momentum Surge',
    'Trend Follower Pro',
    'Volatility Breakout',
    'RSI Reversal',
    'MACD Crossover',
    'Bollinger Squeeze'
  ];
  const descriptions = [
    'Capitalizes on strong price momentum to enter trades in the direction of the trend.',
    'Follows established market trends using multiple timeframe analysis for confirmation.',
    'Identifies and trades breakouts from periods of low volatility for explosive moves.',
    'Spots oversold and overbought conditions using RSI for potential market reversals.',
    'Uses MACD crossovers to identify shifts in momentum and trend direction.',
    'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.'
  ];

  // Create 6 templates with different risk levels
  for (let i = 0; i < 6; i++) {
    const template = {
      title: names[i],
      name: names[i],
      description: descriptions[i],
      risk_level: riskLevels[i],
      type: 'system_template',
      status: 'active',
      selected_pairs: ['BTC/USDT', 'ETH/USDT'],
      strategy_config: {
        indicators: {
          rsi: { period: 14 },
          macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          bb: { period: 20, stdDev: 2 }
        },
        timeframe: '1h',
        entryConditions: [
          { indicator: 'RSI', condition: 'RSI <', value: '30' },
          { indicator: 'MACD', condition: 'MACD Crossover', value: 'Signal Line' }
        ],
        exitConditions: [
          { indicator: 'RSI', condition: 'RSI >', value: '70' },
          { indicator: 'Profit', condition: 'Profit >', value: '5%' }
        ],
        risk_management: {
          stopLoss: 5,
          takeProfit: 10,
          positionSize: 10,
          maxOpenPositions: 5
        }
      }
    };

    templates.push(template);
  }

  return templates;
}

// Run the generator
generateTemplates().catch(console.error);
