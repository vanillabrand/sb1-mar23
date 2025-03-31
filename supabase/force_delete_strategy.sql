-- This SQL script creates functions to force delete strategies and their related records
-- Run this in the Supabase SQL editor

-- Function to delete a strategy and all its related records
CREATE OR REPLACE FUNCTION delete_strategy(strategy_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
BEGIN
    -- Delete trades first
    DELETE FROM trades WHERE strategy_id = strategy_id;
    
    -- Delete any monitoring status records
    BEGIN
        DELETE FROM monitoring_status WHERE strategy_id = strategy_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors if table doesn't exist
        RAISE NOTICE 'Error deleting from monitoring_status: %', SQLERRM;
    END;
    
    -- Delete any strategy performance records
    BEGIN
        DELETE FROM strategy_performance WHERE strategy_id = strategy_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors if table doesn't exist
        RAISE NOTICE 'Error deleting from strategy_performance: %', SQLERRM;
    END;
    
    -- Delete the strategy itself
    DELETE FROM strategies WHERE id = strategy_id;
    
    -- Check if deletion was successful
    IF NOT EXISTS (SELECT 1 FROM strategies WHERE id = strategy_id) THEN
        success := TRUE;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute raw SQL (use with caution)
CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to use these functions
GRANT EXECUTE ON FUNCTION delete_strategy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;

-- Add a trigger to automatically delete related records when a strategy is deleted
CREATE OR REPLACE FUNCTION delete_strategy_related_records()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete trades
    DELETE FROM trades WHERE strategy_id = OLD.id;
    
    -- Delete any monitoring status records
    BEGIN
        DELETE FROM monitoring_status WHERE strategy_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors if table doesn't exist
        RAISE NOTICE 'Error deleting from monitoring_status: %', SQLERRM;
    END;
    
    -- Delete any strategy performance records
    BEGIN
        DELETE FROM strategy_performance WHERE strategy_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors if table doesn't exist
        RAISE NOTICE 'Error deleting from strategy_performance: %', SQLERRM;
    END;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS before_delete_strategy ON strategies;
CREATE TRIGGER before_delete_strategy
BEFORE DELETE ON strategies
FOR EACH ROW
EXECUTE FUNCTION delete_strategy_related_records();

-- Add a function to force delete a strategy by ID (bypassing all constraints)
CREATE OR REPLACE FUNCTION force_delete_strategy(strategy_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := FALSE;
BEGIN
    -- Use a more aggressive approach with explicit transactions
    BEGIN
        -- Start a transaction
        START TRANSACTION;
        
        -- Delete trades first
        EXECUTE 'DELETE FROM trades WHERE strategy_id = $1' USING strategy_id;
        
        -- Delete any monitoring status records
        BEGIN
            EXECUTE 'DELETE FROM monitoring_status WHERE strategy_id = $1' USING strategy_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if table doesn't exist
            RAISE NOTICE 'Error deleting from monitoring_status: %', SQLERRM;
        END;
        
        -- Delete any strategy performance records
        BEGIN
            EXECUTE 'DELETE FROM strategy_performance WHERE strategy_id = $1' USING strategy_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if table doesn't exist
            RAISE NOTICE 'Error deleting from strategy_performance: %', SQLERRM;
        END;
        
        -- Delete the strategy itself
        EXECUTE 'DELETE FROM strategies WHERE id = $1' USING strategy_id;
        
        -- Commit the transaction
        COMMIT;
        
        -- Check if deletion was successful
        IF NOT EXISTS (SELECT 1 FROM strategies WHERE id = strategy_id) THEN
            success := TRUE;
        END IF;
        
        RETURN success;
    EXCEPTION WHEN OTHERS THEN
        -- Rollback the transaction if any error occurs
        ROLLBACK;
        RAISE NOTICE 'Error in force_delete_strategy: %', SQLERRM;
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to use the force_delete_strategy function
GRANT EXECUTE ON FUNCTION force_delete_strategy(UUID) TO authenticated;
