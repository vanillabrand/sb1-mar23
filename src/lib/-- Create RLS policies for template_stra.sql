-- Create RLS policies for template_strategies
ALTER TABLE template_strategies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Template strategies are readable by all authenticated users" ON template_strategies;
DROP POLICY IF EXISTS "Only admins can insert template strategies" ON template_strategies;
DROP POLICY IF EXISTS "Only admins can update template strategies" ON template_strategies;
DROP POLICY IF EXISTS "Only admins can delete template strategies" ON template_strategies;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Template strategies are readable by all authenticated users"
ON template_strategies
FOR SELECT
USING (auth.role() = 'authenticated');

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

-- Create RLS policies for monitoring_status
ALTER TABLE monitoring_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only insert monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only update monitoring status for their own strategies" ON monitoring_status;
DROP POLICY IF EXISTS "Users can only delete monitoring status for their own strategies" ON monitoring_status;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see monitoring status for their own strategies"
ON monitoring_status
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert monitoring status for their own strategies"
ON monitoring_status
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update monitoring status for their own strategies"
ON monitoring_status
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete monitoring status for their own strategies"
ON monitoring_status
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for strategy_performance
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only insert performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only update performance for their own strategies" ON strategy_performance;
DROP POLICY IF EXISTS "Users can only delete performance for their own strategies" ON strategy_performance;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see performance for their own strategies"
ON strategy_performance
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert performance for their own strategies"
ON strategy_performance
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update performance for their own strategies"
ON strategy_performance
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete performance for their own strategies"
ON strategy_performance
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for trade_signals
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can only see trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only insert trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only update trade signals for their own strategies" ON trade_signals;
DROP POLICY IF EXISTS "Users can only delete trade signals for their own strategies" ON trade_signals;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Users can only see trade signals for their own strategies"
ON trade_signals
FOR SELECT
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only insert trade signals for their own strategies"
ON trade_signals
FOR INSERT
WITH CHECK (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only update trade signals for their own strategies"
ON trade_signals
FOR UPDATE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can only delete trade signals for their own strategies"
ON trade_signals
FOR DELETE
USING (
    strategy_id IN (
        SELECT id FROM strategies WHERE user_id = auth.uid()
    )
);