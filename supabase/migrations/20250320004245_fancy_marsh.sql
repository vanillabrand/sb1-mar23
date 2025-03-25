/*
  # Fix Strategy Templates Policies

  1. Changes
    - Update RLS policies for strategy_templates table
    - Fix policy permissions for authenticated users
*/

-- Update policies for strategy_templates
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Templates are viewable by everyone" ON strategy_templates;
  DROP POLICY IF EXISTS "Authenticated users can create templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Template owners can update their templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Template owners can delete their templates" ON strategy_templates;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Templates are viewable by everyone" 
  ON strategy_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create templates" 
  ON strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Template owners can update their templates" 
  ON strategy_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Template owners can delete their templates" 
  ON strategy_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);