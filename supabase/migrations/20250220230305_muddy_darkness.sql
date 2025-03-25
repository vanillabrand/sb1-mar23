/*
  # Create strategies and related tables

  1. New Tables
    - `strategies`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `type` (text)
      - `status` (text)
      - `performance` (numeric)
      - `risk_level` (text)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `strategy_trades`
      - `id` (uuid, primary key)
      - `strategy_id` (uuid, foreign key)
      - `pair` (text)
      - `type` (text)
      - `entry_price` (numeric)
      - `current_price` (numeric)
      - `pnl` (numeric)
      - `pnl_percent` (numeric)
      - `status` (text)
      - `duration` (interval)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  performance numeric DEFAULT 0,
  risk_level text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT valid_risk_level CHECK (risk_level IN ('Low', 'Medium', 'High'))
);

-- Create strategy trades table
CREATE TABLE IF NOT EXISTS strategy_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  pair text NOT NULL,
  type text NOT NULL,
  entry_price numeric NOT NULL,
  current_price numeric NOT NULL,
  pnl numeric DEFAULT 0,
  pnl_percent numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  duration interval,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_trade_type CHECK (type IN ('Long', 'Short')),
  CONSTRAINT valid_trade_status CHECK (status IN ('open', 'closed'))
);

-- Enable RLS
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_trades ENABLE ROW LEVEL SECURITY;

-- Create policies for strategies
CREATE POLICY "Users can create their own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for strategy trades
CREATE POLICY "Users can manage trades for their strategies"
  ON strategy_trades
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_trades.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_trades_updated_at
  BEFORE UPDATE ON strategy_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();