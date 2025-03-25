/*
  # Strategy Library and Budget Management

  1. New Tables
    - `strategy_templates`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `risk_level` (text)
      - `metrics` (jsonb)
      - `config` (jsonb)
      - `user_id` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `strategy_budgets`
      - `id` (uuid, primary key)
      - `strategy_id` (uuid)
      - `total` (numeric)
      - `allocated` (numeric)
      - `available` (numeric)
      - `max_position_size` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `budget_history`
      - `id` (uuid, primary key)
      - `budget_id` (uuid)
      - `total_before` (numeric)
      - `total_after` (numeric)
      - `allocated_before` (numeric)
      - `allocated_after` (numeric)
      - `available_before` (numeric)
      - `available_after` (numeric)
      - `reason` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add foreign key constraints

  3. Triggers
    - Add trigger for budget history tracking
    - Add trigger for updated_at timestamp
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS budget_history;
DROP TABLE IF EXISTS strategy_budgets;
DROP TABLE IF EXISTS strategy_templates;

-- Create strategy_templates table
CREATE TABLE strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  risk_level text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{"winRate": 0, "avgReturn": 0}'::jsonb,
  config jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_risk_level CHECK (
    risk_level = ANY (ARRAY['Ultra Low', 'Low', 'Medium', 'High', 'Ultra High', 'Extreme', 'God Mode'])
  )
);

-- Create strategy_budgets table
CREATE TABLE strategy_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  allocated numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  max_position_size numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT positive_amounts CHECK (
    total >= 0 AND
    allocated >= 0 AND
    available >= 0 AND
    max_position_size >= 0
  ),
  CONSTRAINT valid_allocation CHECK (
    allocated + available = total
  )
);

-- Create budget_history table
CREATE TABLE budget_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES strategy_budgets(id) ON DELETE CASCADE,
  total_before numeric NOT NULL,
  total_after numeric NOT NULL,
  allocated_before numeric NOT NULL,
  allocated_after numeric NOT NULL,
  available_before numeric NOT NULL,
  available_after numeric NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;

-- Create policies for strategy_templates
CREATE POLICY "Public templates are viewable by everyone" 
  ON strategy_templates
  FOR SELECT 
  TO authenticated 
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can create their own custom templates" 
  ON strategy_templates
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
  ON strategy_templates
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
  ON strategy_templates
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create policies for strategy_budgets
CREATE POLICY "Users can view their own budgets" 
  ON strategy_budgets
  FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies 
    WHERE strategies.id = strategy_budgets.strategy_id 
    AND strategies.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own budgets" 
  ON strategy_budgets
  FOR ALL 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategies 
    WHERE strategies.id = strategy_budgets.strategy_id 
    AND strategies.user_id = auth.uid()
  ));

-- Create policies for budget_history
CREATE POLICY "Users can view their own budget history" 
  ON budget_history
  FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM strategy_budgets sb
    JOIN strategies s ON s.id = sb.strategy_id
    WHERE sb.id = budget_history.budget_id 
    AND s.user_id = auth.uid()
  ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for strategy_templates
CREATE TRIGGER update_strategy_templates_updated_at
  BEFORE UPDATE ON strategy_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

-- Create trigger for budget history
CREATE TRIGGER log_budget_changes_trigger
  AFTER UPDATE ON strategy_budgets
  FOR EACH ROW
  EXECUTE FUNCTION log_budget_changes('manual_update');

-- Create indexes
CREATE INDEX strategy_templates_user_id_idx ON strategy_templates(user_id);
CREATE INDEX strategy_budgets_strategy_id_idx ON strategy_budgets(strategy_id);
CREATE INDEX budget_history_budget_id_idx ON budget_history(budget_id);