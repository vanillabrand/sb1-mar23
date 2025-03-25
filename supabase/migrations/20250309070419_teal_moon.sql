/*
  # Create strategy templates table and functions

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

  2. Security
    - Enable RLS on `strategy_templates` table
    - Add policies for authenticated users to:
      - Read all templates
      - Create templates if they own them
      - Update/delete their own templates
*/

-- Create strategy_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.strategy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  risk_level text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategy_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop read policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'strategy_templates' 
    AND policyname = 'Users can read all templates'
  ) THEN
    DROP POLICY "Users can read all templates" ON public.strategy_templates;
  END IF;

  -- Drop create policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'strategy_templates' 
    AND policyname = 'Users can create their own templates'
  ) THEN
    DROP POLICY "Users can create their own templates" ON public.strategy_templates;
  END IF;

  -- Drop update policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'strategy_templates' 
    AND policyname = 'Users can update their own templates'
  ) THEN
    DROP POLICY "Users can update their own templates" ON public.strategy_templates;
  END IF;

  -- Drop delete policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'strategy_templates' 
    AND policyname = 'Users can delete their own templates'
  ) THEN
    DROP POLICY "Users can delete their own templates" ON public.strategy_templates;
  END IF;
END $$;

-- Create policies
CREATE POLICY "Users can read all templates"
  ON public.strategy_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own templates"
  ON public.strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.strategy_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.strategy_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_strategy_templates_updated_at ON public.strategy_templates;
CREATE TRIGGER update_strategy_templates_updated_at
  BEFORE UPDATE ON public.strategy_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add risk level check constraint
DO $$ 
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_risk_level' 
    AND conrelid = 'public.strategy_templates'::regclass
  ) THEN
    ALTER TABLE public.strategy_templates DROP CONSTRAINT valid_risk_level;
  END IF;

  -- Add constraint
  ALTER TABLE public.strategy_templates
    ADD CONSTRAINT valid_risk_level
    CHECK (risk_level = ANY (ARRAY[
      'Ultra Low'::text,
      'Low'::text,
      'Medium'::text,
      'High'::text,
      'Ultra High'::text,
      'Extreme'::text,
      'God Mode'::text
    ]));
END $$;