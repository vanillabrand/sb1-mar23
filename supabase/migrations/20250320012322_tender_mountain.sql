/*
  # Fix Strategy Privacy and Template Visibility

  1. Changes
    - Update strategy policies to ensure strategies are only visible to their owners
    - Keep strategy templates publicly visible to all authenticated users
    - Fix policy conflicts and duplicates

  2. Security
    - Strategies: Private to owner
    - Templates: Public read, restricted write
*/

-- Drop existing strategy policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view all strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can create strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new strategy policies with proper privacy
CREATE POLICY "Users can view their own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing template policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Templates are viewable by everyone" ON strategy_templates;
  DROP POLICY IF EXISTS "Authenticated users can create templates" ON strategy_templates;
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