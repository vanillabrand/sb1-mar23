/*
  # Create Strategy Templates Table

  1. New Tables
    - `strategy_templates`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `risk_level` (text)
      - `metrics` (jsonb)
      - `config` (jsonb)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `strategy_templates` table
    - Add policies for authenticated users to manage their templates
*/

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can create their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can update their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can delete their own templates" ON strategy_templates;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create strategy_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  risk_level text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{"winRate": 0, "avgReturn": 0}'::jsonb,
  config jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own templates"
  ON strategy_templates
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own templates"
  ON strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own templates"
  ON strategy_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON strategy_templates
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER update_strategy_templates_updated_at
    BEFORE UPDATE ON strategy_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;