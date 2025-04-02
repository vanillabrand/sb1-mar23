-- This script creates the trade_signals table if it doesn't exist

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

-- Create indexes for trade_signals
CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy ON trade_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_expires ON trade_signals(expires_at);

-- Enable RLS for trade_signals
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only see trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only insert trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only update trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only delete trade signals for their own strategies" ON trade_signals;

-- Users can only see trade signals for their own strategies
CREATE POLICY "Users can only see trade signals for their own strategies"
ON trade_signals
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert trade signals for their own strategies
CREATE POLICY "Users can only insert trade signals for their own strategies"
ON trade_signals
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update trade signals for their own strategies
CREATE POLICY "Users can only update trade signals for their own strategies"
ON trade_signals
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete trade signals for their own strategies
CREATE POLICY "Users can only delete trade signals for their own strategies"
ON trade_signals
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);
