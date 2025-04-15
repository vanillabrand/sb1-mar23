-- Create the update_strategy_status function
CREATE OR REPLACE FUNCTION update_strategy_status(strategy_id UUID, new_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE strategies
  SET 
    status = new_status,
    updated_at = NOW(),
    deactivated_at = CASE WHEN new_status = 'inactive' THEN NOW() ELSE deactivated_at END
  WHERE id = strategy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
