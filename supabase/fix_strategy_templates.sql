-- This script fixes the strategy_templates table by adding the missing user_id column

-- First, check if the user_id column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'user_id'
    ) THEN
        -- Add the user_id column
        ALTER TABLE strategy_templates
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added user_id column to strategy_templates table';
    ELSE
        RAISE NOTICE 'user_id column already exists in strategy_templates table';
    END IF;
END $$;

-- Check if the title column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'title'
    ) THEN
        -- Add the title column
        ALTER TABLE strategy_templates
        ADD COLUMN title TEXT;
        
        -- Copy values from name to title for consistency
        UPDATE strategy_templates
        SET title = name
        WHERE title IS NULL;
        
        RAISE NOTICE 'Added title column to strategy_templates table';
    ELSE
        RAISE NOTICE 'title column already exists in strategy_templates table';
    END IF;
END $$;

-- Check if the risk_level column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'strategy_templates'
        AND column_name = 'risk_level'
    ) THEN
        -- Add the risk_level column
        ALTER TABLE strategy_templates
        ADD COLUMN risk_level TEXT;
        
        RAISE NOTICE 'Added risk_level column to strategy_templates table';
    ELSE
        RAISE NOTICE 'risk_level column already exists in strategy_templates table';
    END IF;
END $$;

-- Make sure the RLS policies are set up correctly
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can insert template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can update template strategies" ON strategy_templates;
DROP POLICY IF EXISTS "Only admins can delete template strategies" ON strategy_templates;

-- Create policies that work with or without the user_id column
CREATE POLICY "Template strategies are readable by all authenticated users"
ON strategy_templates
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can insert template strategies"
ON strategy_templates
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can update template strategies"
ON strategy_templates
FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Only admins can delete template strategies"
ON strategy_templates
FOR DELETE
USING (auth.role() = 'service_role');
