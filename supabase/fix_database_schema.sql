-- This script fixes the database schema issues

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
        INSERT INTO strategy_templates (id, title, name, description, type, risk_level, strategy_config, selected_pairs)
        VALUES
            (uuid_generate_v4(), 'Momentum Surge', 'Momentum Surge', 'Capitalizes on strong price momentum to enter trades in the direction of the trend.', 'system_template', 'Low',
            '{"indicatorType": "momentum", "timeframe": "1h", "entryConditions": {"momentumThreshold": 0.5, "volumeIncrease": 20, "minPriceChange": 1.5, "direction": "both", "confirmationCandles": 3, "indicators": {"rsi": {"period": 14, "overbought": 70, "oversold": 30}, "macd": {"fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9}}}, "exitConditions": {"takeProfitPercentage": 3.5, "stopLossPercentage": 2.0, "trailingStopPercentage": 1.0, "maxDurationHours": 48, "exitOnMomentumReversal": true, "rsiExitLevel": 50}, "riskManagement": {"positionSizePercentage": 5, "maxOpenTrades": 3, "maxDailyLoss": 5}}',
            '["BTC/USDT"]'),

            (uuid_generate_v4(), 'Trend Follower Pro', 'Trend Follower Pro', 'Follows established market trends using multiple timeframe analysis for confirmation.', 'system_template', 'Medium',
            '{"indicatorType": "trend", "timeframe": "4h", "entryConditions": {"primaryTimeframe": "4h", "confirmationTimeframe": "1d", "direction": "both", "minTrendStrength": 70, "indicators": {"ema": {"shortPeriod": 20, "longPeriod": 50, "direction": "cross"}, "adx": {"period": 14, "threshold": 25}, "supertrend": {"period": 10, "multiplier": 3}}}, "exitConditions": {"takeProfitPercentage": 8.0, "stopLossPercentage": 4.0, "trailingStopPercentage": 2.0, "maxDurationHours": 120, "exitOnTrendReversal": true, "exitOnEMACrossover": true}, "riskManagement": {"positionSizePercentage": 10, "maxOpenTrades": 5, "maxDailyLoss": 8}}',
            '["ETH/USDT"]'),

            (uuid_generate_v4(), 'Volatility Breakout', 'Volatility Breakout', 'Identifies and trades breakouts from periods of low volatility for explosive moves.', 'system_template', 'High',
            '{"indicatorType": "volatility", "timeframe": "15m", "entryConditions": {"volatilityPercentile": 20, "breakoutPercentage": 3.0, "volumeMultiplier": 2.5, "direction": "both", "consolidationPeriod": 24, "indicators": {"bollinger": {"period": 20, "deviations": 2.0, "squeezeThreshold": 0.1}, "atr": {"period": 14, "multiplier": 1.5}, "keltnerChannels": {"period": 20, "multiplier": 1.5}}}, "exitConditions": {"takeProfitPercentage": 15.0, "stopLossPercentage": 7.0, "trailingStopPercentage": 3.5, "maxDurationHours": 24, "exitOnVolatilityContraction": true, "atrMultiplierExit": 2.0}, "riskManagement": {"positionSizePercentage": 15, "maxOpenTrades": 3, "maxDailyLoss": 12}}',
            '["SOL/USDT"]'),

            (uuid_generate_v4(), 'RSI Reversal', 'RSI Reversal', 'Spots oversold and overbought conditions using RSI for potential market reversals.', 'system_template', 'Medium',
            '{"indicatorType": "oscillator", "timeframe": "2h", "entryConditions": {"overboughtLevel": 75, "oversoldLevel": 25, "confirmationCandles": 2, "direction": "both", "indicators": {"rsi": {"period": 14, "smoothing": 3}, "stochastic": {"kPeriod": 14, "dPeriod": 3, "slowing": 3, "overbought": 80, "oversold": 20}, "priceAction": {"confirmationNeeded": true}}}, "exitConditions": {"takeProfitPercentage": 5.0, "stopLossPercentage": 3.0, "trailingStopPercentage": 1.5, "maxDurationHours": 36, "rsiCenterCrossExit": true, "exitLevel": 50}, "riskManagement": {"positionSizePercentage": 8, "maxOpenTrades": 4, "maxDailyLoss": 7}}',
            '["BNB/USDT"]'),

            (uuid_generate_v4(), 'MACD Crossover', 'MACD Crossover', 'Uses MACD crossovers to identify shifts in momentum and trend direction.', 'system_template', 'Low',
            '{"indicatorType": "momentum", "timeframe": "6h", "entryConditions": {"signalCrossover": true, "histogramReversal": true, "direction": "both", "confirmationCandles": 1, "indicators": {"macd": {"fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9}, "ema": {"period": 200, "respectTrend": true}, "volume": {"minIncrease": 10}}}, "exitConditions": {"takeProfitPercentage": 4.0, "stopLossPercentage": 2.5, "trailingStopPercentage": 1.2, "maxDurationHours": 72, "exitOnOppositeSignal": true, "macdHistogramReversal": true}, "riskManagement": {"positionSizePercentage": 6, "maxOpenTrades": 5, "maxDailyLoss": 5}}',
            '["XRP/USDT"]'),

            (uuid_generate_v4(), 'Bollinger Squeeze', 'Bollinger Squeeze', 'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.', 'system_template', 'High',
            '{"indicatorType": "volatility", "timeframe": "30m", "entryConditions": {"bandwidthThreshold": 0.1, "expansionPercentage": 2.5, "direction": "both", "minimumContractionPeriod": 12, "indicators": {"bollinger": {"period": 20, "deviations": 2.0}, "keltner": {"period": 20, "atrMultiplier": 1.5}, "momentum": {"indicator": "rsi", "period": 14, "threshold": 50}}}, "exitConditions": {"takeProfitPercentage": 12.0, "stopLossPercentage": 6.0, "trailingStopPercentage": 3.0, "maxDurationHours": 48, "bandwidthExpansionExit": 2.0, "priceRetracementExit": 0.5}, "riskManagement": {"positionSizePercentage": 12, "maxOpenTrades": 3, "maxDailyLoss": 10}}',
            '["ADA/USDT"]');

        RAISE NOTICE 'Inserted 6 demo template strategies';
    ELSE
        RAISE NOTICE 'Template strategies already exist, skipping demo data insertion';
    END IF;
END $$;
