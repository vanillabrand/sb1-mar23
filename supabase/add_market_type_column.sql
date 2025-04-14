-- This SQL script adds the market_type column to the strategies and strategy_templates tables
-- and adds the entryConditions column to the strategy_templates table if it doesn't exist
-- Run this in the Supabase SQL editor

-- Add market_type column to strategies table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'market_type') THEN
        ALTER TABLE strategies ADD COLUMN market_type TEXT DEFAULT 'spot';
        RAISE NOTICE 'Added market_type column to strategies table';
    END IF;
END $$;

-- Add constraint to strategies table
ALTER TABLE strategies
ADD CONSTRAINT strategies_market_type_check
CHECK (market_type IN ('spot', 'margin', 'futures'));

-- Add market_type column to strategy_templates table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'market_type') THEN
        ALTER TABLE strategy_templates ADD COLUMN market_type TEXT DEFAULT 'spot';
        RAISE NOTICE 'Added market_type column to strategy_templates table';
    END IF;
END $$;

-- Add constraint to strategy_templates table
ALTER TABLE strategy_templates
ADD CONSTRAINT strategy_templates_market_type_check
CHECK (market_type IN ('spot', 'margin', 'futures'));

-- Add entryConditions column to strategy_templates table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategy_templates' AND column_name = 'entry_conditions') THEN
        ALTER TABLE strategy_templates ADD COLUMN entry_conditions JSONB DEFAULT '[]'::JSONB;
        RAISE NOTICE 'Added entry_conditions column to strategy_templates table';
    END IF;
END $$;

-- Refresh the schema cache to ensure the new columns are recognized
SELECT pg_catalog.pg_reload_conf();
