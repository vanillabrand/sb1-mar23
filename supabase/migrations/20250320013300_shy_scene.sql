/*
  # Fix Strategy RLS Policies

  1. Changes
    - Drop all existing strategy policies
    - Create new policies ensuring strategies are private to owners
    - Keep template policies unchanged
    - Fix policy naming conflicts

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
CREATE POLICY "Users can view own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());