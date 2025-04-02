-- This script fixes issues with strategy creation and template generation

-- First, make sure the UUID extension is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check if strategies table exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategies') THEN
        CREATE TABLE strategies (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'custom',
            status TEXT DEFAULT 'inactive',
            risk_level TEXT,
            riskLevel TEXT,
            selected_pairs JSONB DEFAULT '[]'::JSONB,
            strategy_config JSONB DEFAULT '{}'::JSONB,
            performance NUMERIC DEFAULT 0
        );
        
        -- Create index on user_id for faster queries
        CREATE INDEX idx_strategies_user_id ON strategies(user_id);
        
        RAISE NOTICE 'Created strategies table';
    ELSE
        -- Make sure all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'risk_level') THEN
            ALTER TABLE strategies ADD COLUMN risk_level TEXT;
            RAISE NOTICE 'Added risk_level column to strategies table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'riskLevel') THEN
            ALTER TABLE strategies ADD COLUMN riskLevel TEXT;
            RAISE NOTICE 'Added riskLevel column to strategies table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'selected_pairs') THEN
            ALTER TABLE strategies ADD COLUMN selected_pairs JSONB DEFAULT '[]'::JSONB;
            RAISE NOTICE 'Added selected_pairs column to strategies table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'strategy_config') THEN
            ALTER TABLE strategies ADD COLUMN strategy_config JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added strategy_config column to strategies table';
        END IF;
        
        RAISE NOTICE 'Strategies table already exists, checked for required columns';
    END IF;
END $$;

-- Check if strategy_templates table exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategy_templates') THEN
        CREATE TABLE strategy_templates (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'system_template',
            status TEXT DEFAULT 'active',
            risk_level TEXT,
            riskLevel TEXT,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            selected_pairs JSONB DEFAULT '[]'::JSONB,
            strategy_config JSONB DEFAULT '{}'::JSONB,
            performance NUMERIC DEFAULT 0
        );
        
        RAISE NOTICE 'Created strategy_templates table';
    ELSE
        -- Make sure all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'risk_level') THEN
            ALTER TABLE strategy_templates ADD COLUMN risk_level TEXT;
            RAISE NOTICE 'Added risk_level column to strategy_templates table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'riskLevel') THEN
            ALTER TABLE strategy_templates ADD COLUMN riskLevel TEXT;
            RAISE NOTICE 'Added riskLevel column to strategy_templates table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'user_id') THEN
            ALTER TABLE strategy_templates ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added user_id column to strategy_templates table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'selected_pairs') THEN
            ALTER TABLE strategy_templates ADD COLUMN selected_pairs JSONB DEFAULT '[]'::JSONB;
            RAISE NOTICE 'Added selected_pairs column to strategy_templates table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'strategy_config') THEN
            ALTER TABLE strategy_templates ADD COLUMN strategy_config JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added strategy_config column to strategy_templates table';
        END IF;
        
        RAISE NOTICE 'Strategy_templates table already exists, checked for required columns';
    END IF;
END $$;

-- Enable Row Level Security for both tables
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strategies
DROP POLICY IF EXISTS "Users can only see their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only insert their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only update their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only delete their own strategies" ON strategies;

CREATE POLICY "Users can only see their own strategies" ON strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own strategies" ON strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own strategies" ON strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own strategies" ON strategies FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for strategy_templates
DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can insert template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can update template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can delete template strategies" ON strategy_templates;

CREATE POLICY "Template strategies are readable by all authenticated users" ON strategy_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only admins can insert template strategies" ON strategy_templates FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);
CREATE POLICY "Only admins can update template strategies" ON strategy_templates FOR UPDATE USING (auth.role() = 'service_role' OR auth.uid() = user_id);
CREATE POLICY "Only admins can delete template strategies" ON strategy_templates FOR DELETE USING (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Insert demo template strategies if none exist
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM strategy_templates;
    
    IF template_count = 0 THEN
        INSERT INTO strategy_templates (id, title, description, type, risk_level, strategy_config, selected_pairs)
        VALUES 
            (uuid_generate_v4(), 'Momentum Surge', 'Capitalizes on strong price momentum to enter trades in the direction of the trend.', 'system_template', 'Low', '{"indicatorType": "momentum", "entryConditions": {}, "exitConditions": {}}', '["BTC/USDT"]'),
            (uuid_generate_v4(), 'Trend Follower Pro', 'Follows established market trends using multiple timeframe analysis for confirmation.', 'system_template', 'Medium', '{"indicatorType": "trend", "entryConditions": {}, "exitConditions": {}}', '["ETH/USDT"]'),
            (uuid_generate_v4(), 'Volatility Breakout', 'Identifies and trades breakouts from periods of low volatility for explosive moves.', 'system_template', 'High', '{"indicatorType": "volatility", "entryConditions": {}, "exitConditions": {}}', '["SOL/USDT"]'),
            (uuid_generate_v4(), 'RSI Reversal', 'Spots oversold and overbought conditions using RSI for potential market reversals.', 'system_template', 'Medium', '{"indicatorType": "oscillator", "entryConditions": {}, "exitConditions": {}}', '["BNB/USDT"]'),
            (uuid_generate_v4(), 'MACD Crossover', 'Uses MACD crossovers to identify shifts in momentum and trend direction.', 'system_template', 'Low', '{"indicatorType": "momentum", "entryConditions": {}, "exitConditions": {}}', '["XRP/USDT"]'),
            (uuid_generate_v4(), 'Bollinger Squeeze', 'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.', 'system_template', 'High', '{"indicatorType": "volatility", "entryConditions": {}, "exitConditions": {}}', '["ADA/USDT"]');
            
        RAISE NOTICE 'Inserted 6 demo template strategies';
    ELSE
        RAISE NOTICE 'Template strategies already exist, skipping demo data insertion';
    END IF;
END $$;
