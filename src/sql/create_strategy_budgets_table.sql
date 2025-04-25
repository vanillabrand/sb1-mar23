-- Function to create the strategy_budgets table if it doesn't exist
CREATE OR REPLACE FUNCTION create_strategy_budgets_table_if_not_exists()
RETURNS void AS $$
BEGIN
    -- Check if the table exists
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'strategy_budgets'
    ) THEN
        -- Create the table
        CREATE TABLE public.strategy_budgets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            strategy_id UUID NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
            total NUMERIC(20, 2) NOT NULL DEFAULT 0,
            allocated NUMERIC(20, 2) NOT NULL DEFAULT 0,
            available NUMERIC(20, 2) NOT NULL DEFAULT 0,
            max_position_size NUMERIC(5, 2) NOT NULL DEFAULT 0.1,
            profit NUMERIC(20, 2) DEFAULT 0,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Add RLS policies
        ALTER TABLE public.strategy_budgets ENABLE ROW LEVEL SECURITY;

        -- Create policy to allow users to select their own budgets
        CREATE POLICY select_own_budgets ON public.strategy_budgets
            FOR SELECT
            USING (
                strategy_id IN (
                    SELECT id FROM public.strategies
                    WHERE user_id = auth.uid()
                )
            );

        -- Create policy to allow users to insert their own budgets
        CREATE POLICY insert_own_budgets ON public.strategy_budgets
            FOR INSERT
            WITH CHECK (
                strategy_id IN (
                    SELECT id FROM public.strategies
                    WHERE user_id = auth.uid()
                )
            );

        -- Create policy to allow users to update their own budgets
        CREATE POLICY update_own_budgets ON public.strategy_budgets
            FOR UPDATE
            USING (
                strategy_id IN (
                    SELECT id FROM public.strategies
                    WHERE user_id = auth.uid()
                )
            );

        -- Create policy to allow users to delete their own budgets
        CREATE POLICY delete_own_budgets ON public.strategy_budgets
            FOR DELETE
            USING (
                strategy_id IN (
                    SELECT id FROM public.strategies
                    WHERE user_id = auth.uid()
                )
            );

        -- Create index on strategy_id for faster lookups
        CREATE INDEX idx_strategy_budgets_strategy_id ON public.strategy_budgets(strategy_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
