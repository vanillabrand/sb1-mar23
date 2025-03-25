/*
  # Add Monitoring Status and Trade Signals Tables

  1. New Tables
    - `monitoring_status`
      - Tracks real-time monitoring state for each strategy
      - Stores latest indicators, conditions, and market analysis
    
    - `trade_signals`
      - Enhanced trade signal tracking
      - Stores detailed analysis and rationale

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing trigger if it exists
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_monitoring_status_updated_at ON monitoring_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own monitoring status" ON monitoring_status;
  DROP POLICY IF EXISTS "Users can manage own monitoring status" ON monitoring_status;
  DROP POLICY IF EXISTS "Users can view own trade signals" ON trade_signals;
  DROP POLICY IF EXISTS "Users can manage own trade signals" ON trade_signals;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create monitoring_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS monitoring_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('monitoring', 'generating', 'executing', 'idle')),
  message text,
  indicators jsonb,
  market_conditions jsonb,
  last_check timestamptz DEFAULT now(),
  next_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trade_signals table if it doesn't exist
CREATE TABLE IF NOT EXISTS trade_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('Long', 'Short')),
  entry_price numeric NOT NULL,
  stop_loss numeric NOT NULL,
  take_profit numeric NOT NULL,
  trailing_stop numeric,
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  indicators jsonb NOT NULL DEFAULT '{}',
  rationale text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  executed_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_status_strategy ON monitoring_status(strategy_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_status_next_check ON monitoring_status(next_check);
CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy ON trade_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_expires ON trade_signals(expires_at);

-- Enable RLS
ALTER TABLE monitoring_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- Create policies for monitoring_status
CREATE POLICY "Users can view own monitoring status"
  ON monitoring_status
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies
    WHERE strategies.id = monitoring_status.strategy_id
    AND strategies.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own monitoring status"
  ON monitoring_status
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies
    WHERE strategies.id = monitoring_status.strategy_id
    AND strategies.user_id = auth.uid()
  ));

-- Create policies for trade_signals
CREATE POLICY "Users can view own trade signals"
  ON trade_signals
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies
    WHERE strategies.id = trade_signals.strategy_id
    AND strategies.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own trade signals"
  ON trade_signals
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies
    WHERE strategies.id = trade_signals.strategy_id
    AND strategies.user_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_monitoring_status_updated_at
  BEFORE UPDATE ON monitoring_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();