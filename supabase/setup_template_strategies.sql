-- This SQL script sets up the template_strategies table and RLS policies
-- Run this in the Supabase SQL editor

-- Create template_strategies table if it doesn't exist
CREATE TABLE IF NOT EXISTS template_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'template',
    status TEXT DEFAULT 'active',
    selected_pairs JSONB DEFAULT '[]'::JSONB,
    strategy_config JSONB DEFAULT '{}'::JSONB,
    performance NUMERIC DEFAULT 0
);

-- Create RLS policies for template_strategies
ALTER TABLE template_strategies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read template strategies
CREATE POLICY "Template strategies are readable by all authenticated users"
ON template_strategies
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only allow admins to insert, update, or delete template strategies
CREATE POLICY "Only admins can insert template strategies"
ON template_strategies
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can update template strategies"
ON template_strategies
FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Only admins can delete template strategies"
ON template_strategies
FOR DELETE
USING (auth.role() = 'service_role');

-- Create RLS policies for strategies table to ensure user isolation
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Users can only see their own strategies
CREATE POLICY "Users can only see their own strategies"
ON strategies
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own strategies
CREATE POLICY "Users can only insert their own strategies"
ON strategies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own strategies
CREATE POLICY "Users can only update their own strategies"
ON strategies
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own strategies
CREATE POLICY "Users can only delete their own strategies"
ON strategies
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for trades table to ensure user isolation
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Users can only see trades for their own strategies
CREATE POLICY "Users can only see trades for their own strategies"
ON trades
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only insert trades for their own strategies
CREATE POLICY "Users can only insert trades for their own strategies"
ON trades
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only update trades for their own strategies
CREATE POLICY "Users can only update trades for their own strategies"
ON trades
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Users can only delete trades for their own strategies
CREATE POLICY "Users can only delete trades for their own strategies"
ON trades
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Add a function to copy a template strategy to a user's private collection
CREATE OR REPLACE FUNCTION copy_template_strategy(template_id UUID, user_id UUID)
RETURNS UUID AS $$
DECLARE
    new_strategy_id UUID := uuid_generate_v4();
    template_data RECORD;
BEGIN
    -- Get the template strategy
    SELECT * INTO template_data FROM template_strategies WHERE id = template_id;
    
    IF template_data IS NULL THEN
        RAISE EXCEPTION 'Template strategy not found';
    END IF;
    
    -- Insert a new strategy for the user based on the template
    INSERT INTO strategies (
        id,
        created_at,
        updated_at,
        user_id,
        name,
        description,
        type,
        status,
        selected_pairs,
        strategy_config,
        performance
    ) VALUES (
        new_strategy_id,
        NOW(),
        NOW(),
        user_id,
        template_data.name || ' (Copy)',
        template_data.description,
        'custom',
        'inactive',
        template_data.selected_pairs,
        template_data.strategy_config,
        0
    );
    
    RETURN new_strategy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to use the copy_template_strategy function
GRANT EXECUTE ON FUNCTION copy_template_strategy(UUID, UUID) TO authenticated;
