// Script to set up the strategy_templates table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
async function setupStrategyTemplates() {
  try {
    console.log('Setting up strategy_templates table...');

    // Check if the table exists
    const { data: tableExists, error: checkError } = await supabase
      .from('strategy_templates')
      .select('*', { count: 'exact', head: true });

    if (checkError && !checkError.message.includes('does not exist')) {
      console.error('Error checking if table exists:', checkError);
      // Continue anyway
    }

    // If table doesn't exist or we got a "does not exist" error, create it
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('Table does not exist, creating it...');

      // Create the table with SQL query
      const { error: createError } = await supabase.rpc('create_table', {
        table_sql: `
          CREATE TABLE IF NOT EXISTS strategy_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            risk_level TEXT,
            type TEXT DEFAULT 'system_template',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            selected_pairs JSONB DEFAULT '[]'::JSONB,
            strategy_config JSONB DEFAULT '{}'::JSONB,
            metrics JSONB DEFAULT '{"winRate": 50, "avgReturn": 5}'::JSONB
          );
        `
      });

      if (createError) {
        console.error('Error creating table:', createError);
        // Continue anyway, we'll try to insert templates
      } else {
        console.log('Successfully created strategy_templates table');
      }
    } else {
      console.log('Table already exists');
    }

    // Check if we have any templates
    const { data: existingTemplates, error: templatesError } = await supabase
      .from('strategy_templates')
      .select('id')
      .limit(1);

    if (templatesError) {
      console.error('Error checking for templates:', templatesError);
      // Continue anyway, we'll try to create templates
    }

    if (existingTemplates && existingTemplates.length > 0) {
      console.log('Templates already exist, skipping creation');
      return;
    }

    // Create demo templates
    console.log('Creating demo templates...');
    const demoTemplates = createDemoTemplates();

    const { error: insertError } = await supabase
      .from('strategy_templates')
      .insert(demoTemplates);

    if (insertError) {
      console.error('Error inserting demo templates:', insertError);
      return;
    }

    console.log('Successfully created demo templates');
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

  // Market types for different strategies
  const marketTypes = ['spot', 'margin', 'futures'];

  // Create 6 templates with different risk levels
  for (let i = 0; i < 6; i++) {
    // Assign a market type based on the strategy index
    const marketType = marketTypes[i % marketTypes.length];

    const template = {
      title: names[i],
      name: names[i],
      description: descriptions[i] + ` This is a ${marketType} trading strategy.`,
      risk_level: riskLevels[i],
      type: 'system_template',
      status: 'active',
      market_type: marketType,
      selected_pairs: ['BTC/USDT', 'ETH/USDT'],
      metrics: {
        winRate: 50 + Math.floor(Math.random() * 20),
        avgReturn: 3 + Math.floor(Math.random() * 10)
      },
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
          maxOpenPositions: 5,
          ...(marketType === 'futures' ? { leverage: `${Math.min(i + 2, 10)}x` } : {}),
          ...(marketType === 'margin' ? { borrowAmount: `${Math.min((i + 1) * 10, 80)}%` } : {})
        }
      }
    };

    templates.push(template);
  }

  return templates;
}

// Run the setup
setupStrategyTemplates().catch(console.error);
