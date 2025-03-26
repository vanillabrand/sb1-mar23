CREATE OR REPLACE FUNCTION handle_strategy_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Close all open trades first
  UPDATE strategy_trades 
  SET 
    status = 'closed',
    updated_at = now()
  WHERE strategy_id = OLD.id 
  AND status = 'open';

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
