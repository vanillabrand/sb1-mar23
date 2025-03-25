/*
  # Fix Budget History Schema

  1. Changes
    - Drop and recreate budget_history table with correct schema
    - Add proper foreign key relationships
    - Update indexes and policies
    - Update trigger function
*/

-- Drop existing budget_history table and related objects
DROP TABLE IF EXISTS budget_history CASCADE;

-- Create budget_history table with correct schema
CREATE TABLE IF NOT EXISTS budget_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES strategy_budgets(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  total_before numeric NOT NULL,
  total_after numeric NOT NULL,
  allocated_before numeric NOT NULL,
  allocated_after numeric NOT NULL,
  available_before numeric NOT NULL,
  available_after numeric NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_budget_history_budget_id ON budget_history(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_strategy_id ON budget_history(strategy_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_created_at ON budget_history(created_at);

-- Enable RLS
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own budget history"
  ON budget_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = budget_history.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

-- Update log_budget_changes function to include strategy_id
CREATE OR REPLACE FUNCTION log_budget_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_history (
    budget_id,
    strategy_id,
    total_before,
    total_after,
    allocated_before,
    allocated_after,
    available_before,
    available_after,
    reason
  ) VALUES (
    OLD.id,
    OLD.strategy_id,
    OLD.total,
    NEW.total,
    OLD.allocated,
    NEW.allocated,
    OLD.available,
    NEW.available,
    TG_ARGV[0]
  );
  RETURN NEW;
END;
$$ language 'plpgsql';