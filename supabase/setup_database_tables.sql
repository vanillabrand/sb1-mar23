-- This SQL script sets up the necessary tables for the trading application
-- Run this in the Supabase SQL editor

-- Create extension for UUID generation if not already created
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create RLS policies for strategies table to ensure user isolation
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Users can only see their own strategies
CREATE POLICY IF NOT EXISTS "Users can only see their own strategies"
ON strategies
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own strategies
CREATE POLICY IF NOT EXISTS "Users can only insert their own strategies"
ON strategies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own strategies
CREATE POLICY IF NOT EXISTS "Users can only update their own strategies"
ON strategies
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own strategies
CREATE POLICY IF NOT EXISTS "Users can only delete their own strategies"
ON strategies
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for trades table to ensure user isolation
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Users can only see trades for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only see trades for their own strategies"
ON trades
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert trades for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only insert trades for their own strategies"
ON trades
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update trades for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only update trades for their own strategies"
ON trades
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete trades for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only delete trades for their own strategies"
ON trades
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for template_strategies
ALTER TABLE template_strategies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read template strategies
CREATE POLICY IF NOT EXISTS "Template strategies are readable by all authenticated users"
ON template_strategies
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only allow admins to insert, update, or delete template strategies
CREATE POLICY IF NOT EXISTS "Only admins can insert template strategies"
ON template_strategies
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Only admins can update template strategies"
ON template_strategies
FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Only admins can delete template strategies"
ON template_strategies
FOR DELETE
USING (auth.role() = 'service_role');

-- Create RLS policies for monitoring_status
ALTER TABLE monitoring_status ENABLE ROW LEVEL SECURITY;

-- Users can only see monitoring status for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only see monitoring status for their own strategies"
ON monitoring_status
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert monitoring status for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only insert monitoring status for their own strategies"
ON monitoring_status
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update monitoring status for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only update monitoring status for their own strategies"
ON monitoring_status
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete monitoring status for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only delete monitoring status for their own strategies"
ON monitoring_status
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for strategy_performance
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;

-- Users can only see performance for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only see performance for their own strategies"
ON strategy_performance
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert performance for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only insert performance for their own strategies"
ON strategy_performance
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update performance for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only update performance for their own strategies"
ON strategy_performance
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete performance for their own strategies
CREATE POLICY IF NOT EXISTS "Users can only delete performance for their own strategies"
ON strategy_performance
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

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
    
    -- Delete any monitoring status records
    DELETE FROM monitoring_status WHERE strategy_id = strategy_id;
    
    -- Delete any strategy performance records
    DELETE FROM strategy_performance WHERE strategy_id = strategy_id;
    
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
