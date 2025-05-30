/*
  # Add Strategy Templates Table

  1. New Tables
    - `strategy_templates`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `title` (text)
      - `description` (text)
      - `risk_level` (text)
      - `config` (jsonb)
      - `metrics` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `strategy_templates` table
    - Add policies for:
      - Users can read their own templates
      - Users can create their own templates
      - Users can update their own templates
      - Users can delete their own templates

  3. Changes
    - Add check constraint for valid risk levels
*/

-- Create strategy_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  risk_level text NOT NULL,
  config jsonb,
  metrics jsonb,
  created_at timestamptz DEFAULT now(),
  
  -- Add check constraint for risk levels
  CONSTRAINT valid_risk_level CHECK (
    risk_level IN (
      'Ultra Low',
      'Low',
      'Medium',
      'High',
      'Ultra High',
      'Extreme',
      'God Mode'
    )
  )
);

-- Enable RLS
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can create their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can update their own templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Users can delete their own templates" ON strategy_templates;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create policies
CREATE POLICY "Users can read their own templates"
  ON strategy_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON strategy_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON strategy_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing index if it exists
DROP INDEX IF EXISTS strategy_templates_user_id_idx;

-- Create index for faster lookups
CREATE INDEX strategy_templates_user_id_idx ON strategy_templates(user_id);