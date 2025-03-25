/*
  # Add Strategy Budget Support

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
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own strategy budgets" ON strategy_budgets;
  DROP POLICY IF EXISTS "Users can manage their own budgets" ON strategy_budgets;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create strategy_budgets table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  allocated numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  max_position_size numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on strategy_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_strategy_budgets_strategy_id ON strategy_budgets(strategy_id);

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

CREATE POLICY "Users can manage their own budgets"
  ON strategy_budgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategies
      WHERE strategies.id = strategy_budgets.strategy_id
      AND strategies.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
  CREATE TRIGGER update_strategy_budgets_updated_at
    BEFORE UPDATE ON strategy_budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;