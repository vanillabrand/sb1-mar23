-- Create transaction_history table
CREATE TABLE IF NOT EXISTS transaction_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_id UUID, -- This can be a strategy_id or trade_id
  reference_type TEXT, -- 'strategy' or 'trade' to indicate what reference_id refers to
  type TEXT NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal')),
  amount DECIMAL NOT NULL,
  balance_before DECIMAL NOT NULL,
  balance_after DECIMAL NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::JSONB, -- For additional data like strategy details
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS transaction_history_user_id_idx ON transaction_history(user_id);
CREATE INDEX IF NOT EXISTS transaction_history_reference_id_idx ON transaction_history(reference_id);
CREATE INDEX IF NOT EXISTS transaction_history_created_at_idx ON transaction_history(created_at);

-- Add Row Level Security policies
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS transaction_history_select_policy ON transaction_history;
DROP POLICY IF EXISTS transaction_history_insert_policy ON transaction_history;
DROP POLICY IF EXISTS transaction_history_update_policy ON transaction_history;
DROP POLICY IF EXISTS transaction_history_delete_policy ON transaction_history;

-- Policy: Users can only view their own transactions
CREATE POLICY transaction_history_select_policy ON transaction_history
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own transactions
CREATE POLICY transaction_history_insert_policy ON transaction_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own transactions
CREATE POLICY transaction_history_update_policy ON transaction_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own transactions
CREATE POLICY transaction_history_delete_policy ON transaction_history
  FOR DELETE USING (auth.uid() = user_id);
