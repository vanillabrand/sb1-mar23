-- Create a function to execute SQL statements
CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;

-- Create a function to create the execute_sql function (for use through RPC)
CREATE OR REPLACE FUNCTION create_execute_sql_function()
RETURNS VOID AS $$
BEGIN
    -- This is a no-op since we've already created the function above
    -- But it gives us an RPC endpoint to call
    RAISE NOTICE 'execute_sql function already exists';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_execute_sql_function() TO authenticated;
