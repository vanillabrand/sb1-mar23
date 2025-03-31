-- Create a function to delete a strategy by ID
CREATE OR REPLACE FUNCTION delete_strategy(strategy_id UUID)
RETURNS VOID AS $$
BEGIN
    -- First delete any related trades
    DELETE FROM trades WHERE strategy_id = $1;
    
    -- Then delete the strategy
    DELETE FROM strategies WHERE id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to execute raw SQL (use with caution)
CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to use these functions
GRANT EXECUTE ON FUNCTION delete_strategy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;
