-- Create strategy trades table
CREATE TABLE IF NOT EXISTS strategy_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  pair text NOT NULL,
  symbol text,
  side text,
  type text NOT NULL,
  entry_price numeric NOT NULL,
  current_price numeric NOT NULL,
  exit_price numeric,
  amount numeric,
  pnl numeric DEFAULT 0,
  pnl_percent numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  duration interval,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_trade_type CHECK (type IN ('Long', 'Short')),
  CONSTRAINT valid_trade_status CHECK (status IN ('open', 'closed', 'pending', 'executed'))
);

-- Enable RLS
ALTER TABLE strategy_trades ENABLE ROW LEVEL SECURITY;

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

-- Create function to update updated_at timestamp if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  END IF;
END $$;

-- Create trigger for updated_at
CREATE TRIGGER update_strategy_trades_updated_at
  BEFORE UPDATE ON strategy_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
