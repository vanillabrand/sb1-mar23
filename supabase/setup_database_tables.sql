-- This SQL script sets up the necessary tables for the trading application
-- Run this in the Supabase SQL editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wrap in transaction for atomicity
BEGIN;

-- Function to verify if auth schema exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        RAISE EXCEPTION 'auth schema does not exist. Please ensure Supabase Auth is properly set up.';
    END IF;
END
$$;

-- Verify required tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategies') THEN
        RAISE EXCEPTION 'strategies table does not exist. Please create it first.';
    END IF;
END
$$;

-- Create strategies table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'custom',
    status TEXT DEFAULT 'inactive',
    selected_pairs JSONB DEFAULT '[]'::JSONB,
    strategy_config JSONB DEFAULT '{}'::JSONB,
    performance NUMERIC DEFAULT 0
);

-- Create trades table if it doesn't exist
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    close_price NUMERIC,
    profit NUMERIC,
    close_reason TEXT,
    trade_config JSONB DEFAULT '{}'::JSONB
);

-- Create template_strategies table if it doesn't exist
CREATE TABLE IF NOT EXISTS template_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'template',
    status TEXT DEFAULT 'active',
    selected_pairs JSONB DEFAULT '[]'::JSONB,
    strategy_config JSONB DEFAULT '{}'::JSONB,
    performance NUMERIC DEFAULT 0
);

-- Create monitoring_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS monitoring_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'idle',
    message TEXT,
    indicators JSONB DEFAULT '{}'::JSONB,
    market_conditions JSONB DEFAULT '{}'::JSONB
);

-- Create strategy_performance table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    profit_loss NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    metrics JSONB DEFAULT '{}'::JSONB
);

-- Create trade_signals table if it doesn't exist
CREATE TABLE IF NOT EXISTS trade_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_price NUMERIC,
    target_price NUMERIC,
    stop_loss NUMERIC,
    quantity NUMERIC,
    confidence NUMERIC DEFAULT 0.5,
    signal_type TEXT DEFAULT 'entry',
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Create strategy_templates table if it doesn't exist
DO $$ 
BEGIN
    CREATE TABLE IF NOT EXISTS strategy_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        name TEXT NOT NULL,
        title TEXT,
        description TEXT,
        type TEXT DEFAULT 'template',
        status TEXT DEFAULT 'active',
        risk_level TEXT DEFAULT 'Medium',
        selected_pairs JSONB DEFAULT '["BTC/USDT"]'::JSONB,
        strategy_config JSONB DEFAULT '{
            "indicatorType": "momentum",
            "entryConditions": {},
            "exitConditions": {},
            "tradeParameters": {
                "positionSize": 0.1,
                "maxOpenPositions": 1,
                "stopLoss": 2,
                "takeProfit": 4
            }
        }'::JSONB,
        performance NUMERIC DEFAULT 0,
        CONSTRAINT valid_risk_level CHECK (
            risk_level IN (
                'Ultra Low',
                'Low',
                'Medium',
                'High',
                'Ultra High',
                'Extreme',
                'God Mode'
            )
        )
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_strategy_templates_risk_level ON strategy_templates(risk_level);
    CREATE INDEX IF NOT EXISTS idx_strategy_templates_status ON strategy_templates(status);

EXCEPTION
    WHEN duplicate_table THEN 
        -- Table already exists, update the constraints if needed
        ALTER TABLE strategy_templates 
            DROP CONSTRAINT IF EXISTS valid_risk_level;
        
        ALTER TABLE strategy_templates 
            ADD CONSTRAINT valid_risk_level 
            CHECK (
                risk_level IN (
                    'Ultra Low',
                    'Low',
                    'Medium',
                    'High',
                    'Ultra High',
                    'Extreme',
                    'God Mode'
                )
            );
END $$;

-- Enable RLS
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view templates" ON strategy_templates;
DROP POLICY IF EXISTS "Anyone can create templates" ON strategy_templates;
DROP POLICY IF EXISTS "Anyone can update templates" ON strategy_templates;
DROP POLICY IF EXISTS "Anyone can delete templates" ON strategy_templates;

-- Create new policies
CREATE POLICY "Anyone can view templates"
    ON strategy_templates
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can create templates"
    ON strategy_templates
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can update templates"
    ON strategy_templates
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can delete templates"
    ON strategy_templates
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON strategy_templates TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create transaction_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    reference_id UUID,
    reference_type TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Create RLS policies for strategies table to ensure user isolation
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only see their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only insert their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only update their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only delete their own strategies" ON strategies;

-- Users can only see their own strategies
CREATE POLICY "Users can only see their own strategies"
ON strategies
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own strategies
CREATE POLICY "Users can only insert their own strategies"
ON strategies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own strategies
CREATE POLICY "Users can only update their own strategies"
ON strategies
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own strategies
CREATE POLICY "Users can only delete their own strategies"
ON strategies
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for trades table to ensure user isolation
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only insert trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only update trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only delete trades for their own strategies" ON trades;

-- Create policies
CREATE POLICY "Users can only see trades for their own strategies"
ON trades
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert trades for their own strategies"
ON trades
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update trades for their own strategies"
ON trades
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete trades for their own strategies"
ON trades
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for template_strategies
ALTER TABLE template_strategies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (with error handling)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON template_strategies;
    DROP POLICY IF EXISTS "Only admins can insert template strategies" ON template_strategies;
    DROP POLICY IF EXISTS "Only admins can update template strategies" ON template_strategies;
    DROP POLICY IF EXISTS "Only admins can delete template strategies" ON template_strategies;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'template_strategies table does not exist yet';
END $$;

-- Create policies with proper error handling
DO $$
BEGIN
    CREATE POLICY "Template strategies are readable by all authenticated users"
    ON template_strategies FOR SELECT
    USING (auth.role() = 'authenticated');

    CREATE POLICY "Only admins can insert template strategies"
    ON template_strategies FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

    CREATE POLICY "Only admins can update template strategies"
    ON template_strategies FOR UPDATE
    USING (auth.role() = 'service_role');

    CREATE POLICY "Only admins can delete template strategies"
    ON template_strategies FOR DELETE
    USING (auth.role() = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'policies already exist for template_strategies';
END $$;

-- Create RLS policies for monitoring_status
ALTER TABLE monitoring_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only insert monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only update monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only delete monitoring status for their own strategies" ON monitoring_status;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see monitoring status for their own strategies"
ON monitoring_status
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert monitoring status for their own strategies"
ON monitoring_status
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update monitoring status for their own strategies"
ON monitoring_status
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete monitoring status for their own strategies"
ON monitoring_status
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for strategy_performance
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only insert performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only update performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only delete performance for their own strategies" ON strategy_performance;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see performance for their own strategies"
ON strategy_performance
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert performance for their own strategies"
ON strategy_performance
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update performance for their own strategies"
ON strategy_performance
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete performance for their own strategies"
ON strategy_performance
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for trade_signals
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- Create indexes for trade_signals
CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy ON trade_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_expires ON trade_signals(expires_at);

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only insert trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only update trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only delete trade signals for their own strategies" ON trade_signals;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see trade signals for their own strategies"
ON trade_signals
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert trade signals for their own strategies"
ON trade_signals
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update trade signals for their own strategies"
ON trade_signals
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete trade signals for their own strategies"
ON trade_signals
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for strategy_templates
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can insert template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can update template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can delete template strategies" ON strategy_templates;

-- Allow all authenticated users to read template strategies
CREATE POLICY "Template strategies are readable by all authenticated users"
ON strategy_templates
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only allow admins to insert, update, or delete template strategies
CREATE POLICY "Only admins can insert template strategies"
ON strategy_templates
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can update template strategies"
ON strategy_templates
FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Only admins can delete template strategies"
ON strategy_templates
FOR DELETE
USING (auth.role() = 'service_role');

-- Create RLS policies for transaction_history
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only see their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only insert their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only update their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only delete their own transactions" ON transaction_history;

-- Users can only see their own transactions
CREATE POLICY "Users can only see their own transactions"
ON transaction_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own transactions
CREATE POLICY "Users can only insert their own transactions"
ON transaction_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own transactions
CREATE POLICY "Users can only update their own transactions"
ON transaction_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own transactions
CREATE POLICY "Users can only delete their own transactions"
ON transaction_history
FOR DELETE
USING (auth.uid() = user_id);

-- Add a function to delete a strategy and all its related records
CREATE OR REPLACE FUNCTION delete_strategy(strategy_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
    user_id UUID;
BEGIN
    -- Get the user_id of the strategy
    SELECT s.user_id INTO user_id FROM strategies s WHERE s.id = strategy_id;

    -- Check if the strategy exists and belongs to the current user
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Strategy not found or does not belong to the current user';
    END IF;

    IF user_id != auth.uid() THEN
        RAISE EXCEPTION 'Strategy does not belong to the current user';
    END IF;

    -- Delete trades first
    DELETE FROM trades WHERE strategy_id = strategy_id;

    -- Delete any trade signals
    DELETE FROM trade_signals WHERE strategy_id = strategy_id;

    -- Delete any monitoring status records
    DELETE FROM monitoring_status WHERE strategy_id = strategy_id;

    -- Delete any strategy performance records
    DELETE FROM strategy_performance WHERE strategy_id = strategy_id;

    -- Delete any transaction history records related to this strategy
    DELETE FROM transaction_history WHERE reference_id = strategy_id AND reference_type = 'strategy';

    -- Delete the strategy itself
    DELETE FROM strategies WHERE id = strategy_id;

    -- Check if deletion was successful
    IF NOT EXISTS (SELECT 1 FROM strategies WHERE id = strategy_id) THEN
        success := TRUE;
    END IF;

    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute raw SQL (use with caution)
CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to copy a template strategy to a user's private collection
CREATE OR REPLACE FUNCTION copy_template_strategy(template_id UUID)
RETURNS UUID AS $$
DECLARE
    new_strategy_id UUID := uuid_generate_v4();
    template_data RECORD;
    current_user_id UUID;
BEGIN
    -- Get the current user ID
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found';
    END IF;

    -- Get the template strategy
    SELECT * INTO template_data FROM template_strategies WHERE id = template_id;

    IF template_data IS NULL THEN
        RAISE EXCEPTION 'Template strategy not found';
    END IF;

    -- Insert a new strategy for the user based on the template
    INSERT INTO strategies (
        id,
        created_at,
        updated_at,
        user_id,
        name,
        description,
        type,
        status,
        selected_pairs,
        strategy_config,
        performance
    ) VALUES (
        new_strategy_id,
        NOW(),
        NOW(),
        current_user_id,
        template_data.name || ' (Copy)',
        template_data.description,
        'custom',
        'inactive',
        template_data.selected_pairs,
        template_data.strategy_config,
        0
    );

    RETURN new_strategy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to use these functions
GRANT EXECUTE ON FUNCTION delete_strategy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION copy_template_strategy(UUID) TO authenticated;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
