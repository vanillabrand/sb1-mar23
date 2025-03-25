/*
  # Fix Budget History Table

  1. Changes
    - Drop and recreate budget_history table with correct schema
    - Add proper indexes and constraints
    - Update policies and triggers
*/

-- Drop existing budget_history table if it exists
DROP TABLE IF EXISTS budget_history;

-- Create budget_history table with correct schema
CREATE TABLE IF NOT EXISTS budget_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES strategy_budgets(id) ON DELETE CASCADE,
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
      SELECT 1 FROM strategy_budgets sb
      JOIN strategies s ON s.id = sb.strategy_id
      WHERE sb.id = budget_history.budget_id
      AND s.user_id = auth.uid()
    )
  );

-- Update log_budget_changes function
CREATE OR REPLACE FUNCTION log_budget_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_history (
    budget_id,
    total_before,
    total_after,
    allocated_before,
    allocated_after,
    available_before,
    available_after,
    reason
  ) VALUES (
    OLD.id,
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