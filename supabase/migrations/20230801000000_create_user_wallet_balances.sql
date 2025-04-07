-- Create user_wallet_balances table
CREATE TABLE IF NOT EXISTS user_wallet_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange_id UUID NOT NULL REFERENCES user_exchanges(id) ON DELETE CASCADE,
  spot_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  margin_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  futures_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, exchange_id)
);

-- Add RLS policies
ALTER TABLE user_wallet_balances ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own wallet balances
CREATE POLICY "Users can view their own wallet balances"
  ON user_wallet_balances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own wallet balances
CREATE POLICY "Users can insert their own wallet balances"
  ON user_wallet_balances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own wallet balances
CREATE POLICY "Users can update their own wallet balances"
  ON user_wallet_balances
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for users to delete their own wallet balances
CREATE POLICY "Users can delete their own wallet balances"
  ON user_wallet_balances
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_wallet_balances_updated_at
BEFORE UPDATE ON user_wallet_balances
FOR EACH ROW
EXECUTE FUNCTION update_wallet_balances_updated_at();
