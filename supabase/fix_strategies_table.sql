-- This script fixes the strategies table schema issues

-- First, make sure the UUID extension is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check if strategies table exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategies') THEN
        CREATE TABLE strategies (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'custom',
            status TEXT DEFAULT 'inactive',
            risk_level TEXT,
            selected_pairs JSONB DEFAULT '[]'::JSONB,
            strategy_config JSONB DEFAULT '{}'::JSONB,
            performance NUMERIC DEFAULT 0,
            budget NUMERIC DEFAULT 0
        );

        -- Create index on user_id for faster queries
        CREATE INDEX idx_strategies_user_id ON strategies(user_id);

        RAISE NOTICE 'Created strategies table';
    ELSE
        -- Make sure all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'title') THEN
            ALTER TABLE strategies ADD COLUMN title TEXT;
            RAISE NOTICE 'Added title column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'name') THEN
            ALTER TABLE strategies ADD COLUMN name TEXT;
            RAISE NOTICE 'Added name column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'description') THEN
            ALTER TABLE strategies ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'risk_level') THEN
            ALTER TABLE strategies ADD COLUMN risk_level TEXT;
            RAISE NOTICE 'Added risk_level column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'selected_pairs') THEN
            ALTER TABLE strategies ADD COLUMN selected_pairs JSONB DEFAULT '[]'::JSONB;
            RAISE NOTICE 'Added selected_pairs column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'strategy_config') THEN
            ALTER TABLE strategies ADD COLUMN strategy_config JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added strategy_config column to strategies table';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'budget') THEN
            ALTER TABLE strategies ADD COLUMN budget NUMERIC DEFAULT 0;
            RAISE NOTICE 'Added budget column to strategies table';
        END IF;

        RAISE NOTICE 'Strategies table already exists, checked for required columns';
    END IF;
END $$;

-- Enable Row Level Security for strategies table
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strategies
DROP POLICY IF EXISTS "Users can only see their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only insert their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only update their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can only delete their own strategies" ON strategies;

CREATE POLICY "Users can only see their own strategies" ON strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own strategies" ON strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own strategies" ON strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own strategies" ON strategies FOR DELETE USING (auth.uid() = user_id);

-- Refresh the schema cache to ensure the new columns are recognized
SELECT pg_catalog.pg_reload_conf();
