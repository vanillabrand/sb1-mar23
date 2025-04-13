-- Function to create the strategy_templates table if it doesn't exist
CREATE OR REPLACE FUNCTION create_strategy_templates_table()
RETURNS void AS $$
BEGIN
    -- Check if the table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'strategy_templates'
    ) THEN
        -- Create the table with minimal required fields
        CREATE TABLE public.strategy_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            risk_level TEXT,
            type TEXT DEFAULT 'system_template',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            selected_pairs JSONB DEFAULT '[]'::JSONB,
            strategy_config JSONB DEFAULT '{}'::JSONB,
            metrics JSONB DEFAULT '{"winRate": 50, "avgReturn": 5}'::JSONB
        );

        -- Enable RLS
        ALTER TABLE public.strategy_templates ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Templates are viewable by everyone"
            ON public.strategy_templates
            FOR SELECT
            TO authenticated
            USING (true);

        CREATE POLICY "System can create templates"
            ON public.strategy_templates
            FOR INSERT
            TO authenticated
            WITH CHECK (true);

        CREATE POLICY "Template owners can update their templates"
            ON public.strategy_templates
            FOR UPDATE
            TO authenticated
            USING (
                (type = 'system_template') OR 
                (user_id IS NOT NULL AND user_id = auth.uid())
            );

        CREATE POLICY "Template owners can delete their templates"
            ON public.strategy_templates
            FOR DELETE
            TO authenticated
            USING (
                (type = 'system_template') OR 
                (user_id IS NOT NULL AND user_id = auth.uid())
            );

        -- Add user_id column if auth.users table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'auth' 
            AND table_name = 'users'
        ) THEN
            ALTER TABLE public.strategy_templates 
            ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

        RAISE NOTICE 'Created strategy_templates table';
    ELSE
        RAISE NOTICE 'strategy_templates table already exists';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_strategy_templates_table() TO authenticated;
GRANT EXECUTE ON FUNCTION create_strategy_templates_table() TO anon;
GRANT EXECUTE ON FUNCTION create_strategy_templates_table() TO service_role;
