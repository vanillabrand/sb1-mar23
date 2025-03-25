/*
  # Add Strategy Budgets Support

  1. New Tables
    - `strategy_budgets`
      - `id` (uuid, primary key)
      - `strategy_id` (uuid, references strategies)
      - `total` (numeric)
      - `allocated` (numeric)
      - `available` (numeric)
      - `max_position_size` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on strategy_budgets table
    - Add policies for budget management
    - Add foreign key constraints

  3. Changes
    - Add budget tracking for strategies
    - Add budget history tracking
*/

-- Create strategy_budgets table
CREATE TABLE IF NOT EXISTS strategy_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  allocated numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  max_position_size numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on strategy_id
CREATE INDEX IF NOT EXISTS strategy_budgets_strategy_id_idx ON strategy_budgets(strategy_id);

-- Enable RLS
ALTER TABLE strategy_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own strategy budgets"
  ON strategy_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create budgets for their own strategies"
  ON strategy_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own strategy budgets"
  ON strategy_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own strategy budgets"
  ON strategy_budgets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

-- Create budget_history table for tracking changes
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
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on budget_history
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;

-- Create policies for budget_history
CREATE POLICY "Users can view their own budget history"
  ON budget_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategy_budgets
      JOIN strategies ON strategies.id = strategy_budgets.strategy_id
      WHERE strategy_budgets.id = budget_history.budget_id
      AND strategies.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for strategy_budgets
CREATE TRIGGER update_strategy_budgets_updated_at
  BEFORE UPDATE ON strategy_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to log budget changes
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

-- Create trigger for logging budget changes
CREATE TRIGGER log_budget_changes_trigger
  AFTER UPDATE ON strategy_budgets
  FOR EACH ROW
  EXECUTE FUNCTION log_budget_changes('manual_update');