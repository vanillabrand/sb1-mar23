-- This SQL script creates the missing tables needed for the application
-- Run this in the Supabase SQL editor

-- Create extension for UUID generation if not already created
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_id uuid, -- This can be a strategy_id or trade_id
  reference_type text, -- 'strategy' or 'trade' to indicate what reference_id refers to
  type text NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal', 'strategy_deactivation', 'budget_reset', 'trade_closure')),
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata jsonb DEFAULT '{}'::jsonb, -- For additional data like strategy details
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_reference_id_idx ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create strategy_budgets table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  allocated numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  max_position_size numeric NOT NULL DEFAULT 0,
  profit numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on strategy_id
CREATE INDEX IF NOT EXISTS idx_strategy_budgets_strategy_id ON strategy_budgets(strategy_id);

-- Enable RLS
ALTER TABLE strategy_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own strategy budgets"
  ON strategy_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own budgets"
  ON strategy_budgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );
