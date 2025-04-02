-- This script creates the transaction_history table if it doesn't exist

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

-- Enable RLS for transaction_history
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
