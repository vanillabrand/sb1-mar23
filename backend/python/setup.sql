-- Function to create strategy_budgets table if it doesn't exist
CREATE OR REPLACE FUNCTION create_strategy_budgets_table()
RETURNS void
LANGUAGE plpgsql
AS $$
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
      strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
      total DECIMAL(18, 8) NOT NULL,
      allocated DECIMAL(18, 8) NOT NULL,
      available DECIMAL(18, 8) NOT NULL,
      max_position_size DECIMAL(18, 8) NOT NULL,
      last_updated BIGINT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index
    CREATE INDEX idx_strategy_budgets_strategy_id ON strategy_budgets(strategy_id);
    
    -- Add RLS policy
    ALTER TABLE public.strategy_budgets ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Users can view their own strategy budgets"
      ON public.strategy_budgets FOR SELECT
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));
      
    CREATE POLICY "Users can insert their own strategy budgets"
      ON public.strategy_budgets FOR INSERT
      WITH CHECK (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));
      
    CREATE POLICY "Users can update their own strategy budgets"
      ON public.strategy_budgets FOR UPDATE
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));
      
    CREATE POLICY "Users can delete their own strategy budgets"
      ON public.strategy_budgets FOR DELETE
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));
      
    -- Add trigger for updated_at
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.strategy_budgets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;
