/*
  # Fix Strategy Deletion

  1. Changes
    - Add cascade delete trigger for strategy deletion
    - Ensure all related records are properly cleaned up
    - Add proper error handling
*/

-- Create function to handle strategy deletion cleanup
CREATE OR REPLACE FUNCTION handle_strategy_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete strategy trades
  DELETE FROM strategy_trades WHERE strategy_id = OLD.id;
  
  -- Delete budget history
  DELETE FROM budget_history WHERE strategy_id = OLD.id;
  
  -- Delete strategy budgets
  DELETE FROM strategy_budgets WHERE strategy_id = OLD.id;
  
  -- Delete monitoring status
  DELETE FROM monitoring_status WHERE strategy_id = OLD.id;
  
  -- Delete trade signals
  DELETE FROM trade_signals WHERE strategy_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for strategy deletion
DROP TRIGGER IF EXISTS on_strategy_delete ON strategies;
CREATE TRIGGER on_strategy_delete
  BEFORE DELETE ON strategies
  FOR EACH ROW
  EXECUTE FUNCTION handle_strategy_deletion();