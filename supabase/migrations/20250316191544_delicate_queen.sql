/*
  # Add Strategy Leaderboard Support

  1. Changes
    - Add performance tracking columns to strategies table
    - Add indexes for performance sorting
    - Add function to update strategy performance
*/

-- Add performance tracking columns if they don't exist
DO $$ 
BEGIN
  -- Add performance column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'strategies' AND column_name = 'performance'
  ) THEN
    ALTER TABLE strategies ADD COLUMN performance numeric DEFAULT 0;
  END IF;

  -- Add win_rate column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'strategies' AND column_name = 'win_rate'
  ) THEN
    ALTER TABLE strategies ADD COLUMN win_rate numeric DEFAULT 0;
  END IF;

  -- Add total_trades column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'strategies' AND column_name = 'total_trades'
  ) THEN
    ALTER TABLE strategies ADD COLUMN total_trades integer DEFAULT 0;
  END IF;
END $$;

-- Create index for performance sorting
CREATE INDEX IF NOT EXISTS strategies_performance_idx ON strategies(performance DESC);

-- Create function to update strategy performance
CREATE OR REPLACE FUNCTION update_strategy_performance()
RETURNS TRIGGER AS $$
DECLARE
  total_pnl numeric;
  winning_trades integer;
  total_trades integer;
BEGIN
  -- Calculate total PnL
  SELECT COALESCE(SUM(pnl), 0)
  INTO total_pnl
  FROM strategy_trades
  WHERE strategy_id = NEW.strategy_id AND status = 'closed';

  -- Calculate win rate
  SELECT 
    COUNT(*) FILTER (WHERE pnl > 0),
    COUNT(*)
  INTO winning_trades, total_trades
  FROM strategy_trades
  WHERE strategy_id = NEW.strategy_id AND status = 'closed';

  -- Update strategy performance
  UPDATE strategies
  SET 
    performance = CASE 
      WHEN total_pnl = 0 THEN 0 
      ELSE (total_pnl / ABS(total_pnl)) * (LN(ABS(total_pnl) + 1) * 100)
    END,
    win_rate = CASE 
      WHEN total_trades = 0 THEN 0 
      ELSE (winning_trades::numeric / total_trades) * 100 
    END,
    total_trades = total_trades,
    updated_at = now()
  WHERE id = NEW.strategy_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for performance updates
DROP TRIGGER IF EXISTS update_strategy_performance_trigger ON strategy_trades;
CREATE TRIGGER update_strategy_performance_trigger
  AFTER INSERT OR UPDATE OF status, pnl ON strategy_trades
  FOR EACH ROW
  WHEN (NEW.status = 'closed')
  EXECUTE FUNCTION update_strategy_performance();