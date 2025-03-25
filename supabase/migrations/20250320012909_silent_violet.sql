/*
  # Fix Strategy Privacy and RLS Policies

  1. Changes
    - Drop existing policies
    - Create new policies ensuring strategies are only visible to their owners
    - Keep strategy templates publicly readable
    - Fix policy conflicts

  2. Security
    - Strategies: Private to owner only
    - Templates: Public read, private write
*/

-- Drop existing strategy policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view all strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can view their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can create their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new strategy policies with strict privacy
CREATE POLICY "Users can view their own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Drop existing template policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Templates are viewable by everyone" ON strategy_templates;
  DROP POLICY IF EXISTS "System can create templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Template owners can update their templates" ON strategy_templates;
  DROP POLICY IF EXISTS "Template owners can delete their templates" ON strategy_templates;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new template policies
CREATE POLICY "Templates are viewable by everyone"
  ON strategy_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create templates"
  ON strategy_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Template owners can update own templates"
  ON strategy_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Template owners can delete own templates"
  ON strategy_templates
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());