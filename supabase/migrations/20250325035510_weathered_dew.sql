/*
  # Add Trade Engine Support Tables

  1. Changes
    - Drop and recreate monitoring_status and trade_signals tables
    - Add progress tracking to monitoring status
    - Add conditions tracking to trade signals
    - Add proper triggers and functions
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS trade_signals;
DROP TABLE IF EXISTS monitoring_status;

-- Create monitoring_status table
CREATE TABLE monitoring_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('monitoring', 'generating', 'executing', 'idle')),
  message text,
  progress integer CHECK (progress >= 0 AND progress <= 100),
  indicators jsonb,
  conditions jsonb,
  market_conditions jsonb,
  last_check timestamptz DEFAULT now(),
  next_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trade_signals table
CREATE TABLE trade_signals (
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
  conditions jsonb,
  rationale text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  executed_at timestamptz
);

-- Create indexes
CREATE INDEX idx_monitoring_status_strategy ON monitoring_status(strategy_id);
CREATE INDEX idx_monitoring_status_next_check ON monitoring_status(next_check);
CREATE INDEX idx_trade_signals_strategy ON trade_signals(strategy_id);
CREATE INDEX idx_trade_signals_status ON trade_signals(status);
CREATE INDEX idx_trade_signals_expires ON trade_signals(expires_at);

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

-- Create function to update monitoring status
CREATE OR REPLACE FUNCTION update_monitoring_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for monitoring status updates
CREATE TRIGGER update_monitoring_status_updated_at
  BEFORE UPDATE ON monitoring_status
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_status();

-- Create function to handle trade signal expiry
CREATE OR REPLACE FUNCTION handle_trade_signal_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Update expired signals
  UPDATE trade_signals
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trade signal expiry
CREATE TRIGGER check_trade_signal_expiry
  AFTER INSERT OR UPDATE ON trade_signals
  FOR EACH STATEMENT
  EXECUTE FUNCTION handle_trade_signal_expiry();