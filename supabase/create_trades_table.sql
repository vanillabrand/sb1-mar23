-- This script creates the trades table if it doesn't exist

-- First, make sure the UUID extension is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create trades table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
        CREATE TABLE trades (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            type TEXT DEFAULT 'market',
            status TEXT DEFAULT 'pending',
            amount NUMERIC,
            quantity NUMERIC,
            price NUMERIC,
            entry_price NUMERIC,
            exit_price NUMERIC,
            stop_loss NUMERIC,
            take_profit NUMERIC,
            profit NUMERIC,
            executed_at TIMESTAMP WITH TIME ZONE,
            closed_at TIMESTAMP WITH TIME ZONE,
            trade_config JSONB DEFAULT '{}'::JSONB,
            metadata JSONB DEFAULT '{}'::JSONB
        );
        
        -- Create indexes for faster queries
        CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
        CREATE INDEX idx_trades_status ON trades(status);
        CREATE INDEX idx_trades_symbol ON trades(symbol);
        
        RAISE NOTICE 'Created trades table';
    ELSE
        -- Make sure all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'trade_config') THEN
            ALTER TABLE trades ADD COLUMN trade_config JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added trade_config column to trades table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'metadata') THEN
            ALTER TABLE trades ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added metadata column to trades table';
        END IF;
        
        RAISE NOTICE 'Trades table already exists, checked for required columns';
    END IF;
END $$;

-- Enable Row Level Security for trades table
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trades
DROP POLICY IF EXISTS "Users can only see trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only insert trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only update trades for their own strategies" ON trades;
DROP POLICY IF EXISTS "Users can only delete trades for their own strategies" ON trades;

-- Users can only see trades for their own strategies
CREATE POLICY "Users can only see trades for their own strategies"
ON trades
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert trades for their own strategies
CREATE POLICY "Users can only insert trades for their own strategies"
ON trades
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update trades for their own strategies
CREATE POLICY "Users can only update trades for their own strategies"
ON trades
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete trades for their own strategies
CREATE POLICY "Users can only delete trades for their own strategies"
ON trades
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);
