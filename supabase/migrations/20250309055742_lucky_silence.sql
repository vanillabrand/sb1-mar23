/*
  # Create strategy templates table

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
    - Add policies for authenticated users to read their own templates
*/

-- Create strategy templates table
CREATE TABLE IF NOT EXISTS strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  risk_level text NOT NULL,
  config jsonb,
  metrics jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read their own templates"
  ON strategy_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
  ON strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON strategy_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);