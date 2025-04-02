-- This script fixes all the tables in the database

-- First, make sure the UUID extension is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fix the strategy_templates table
DO $$
BEGIN
    -- Check if the user_id column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'user_id'
    ) THEN
        -- Add the user_id column
        ALTER TABLE strategy_templates
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added user_id column to strategy_templates table';
    ELSE
        RAISE NOTICE 'user_id column already exists in strategy_templates table';
    END IF;
END $$;

-- Check if the title column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'title'
    ) THEN
        -- Add the title column
        ALTER TABLE strategy_templates
        ADD COLUMN title TEXT;
        
        -- Copy values from name to title for consistency
        UPDATE strategy_templates
        SET title = name
        WHERE title IS NULL;
        
        RAISE NOTICE 'Added title column to strategy_templates table';
    ELSE
        RAISE NOTICE 'title column already exists in strategy_templates table';
    END IF;
END $$;

-- Check if the risk_level column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'risk_level'
    ) THEN
        -- Add the risk_level column
        ALTER TABLE strategy_templates
        ADD COLUMN risk_level TEXT;
        
        RAISE NOTICE 'Added risk_level column to strategy_templates table';
    ELSE
        RAISE NOTICE 'risk_level column already exists in strategy_templates table';
    END IF;
END $$;

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy ON trade_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_expires ON trade_signals(expires_at);

-- Enable RLS for all tables
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can insert template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can update template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can delete template strategies" ON strategy_templates;

DROP POLICY IF EXISTS "Users can only see trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only insert trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only update trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only delete trade signals for their own strategies" ON trade_signals;

DROP POLICY IF EXISTS "Users can only see their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only insert their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only update their own transactions" ON transaction_history;
DROP POLICY IF EXISTS "Users can only delete their own transactions" ON transaction_history;

-- Create policies for strategy_templates
CREATE POLICY "Template strategies are readable by all authenticated users"
ON strategy_templates
FOR SELECT
USING (auth.role() = 'authenticated');

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

-- Create policies for trade_signals
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

-- Create policies for transaction_history
CREATE POLICY "Users can only see their own transactions"
ON transaction_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own transactions"
ON transaction_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own transactions"
ON transaction_history
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own transactions"
ON transaction_history
FOR DELETE
USING (auth.uid() = user_id);
