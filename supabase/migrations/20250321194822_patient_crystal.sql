/*
  # Fix Strategy RLS Policies

  1. Changes
    - Drop and recreate strategy policies with proper user access
    - Add explicit user_id check in USING clause
    - Add index for better performance
*/

-- Drop existing strategy policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can create own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Create new strategy policies with proper user access
CREATE POLICY "Users can view own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "Users can create own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE 
      WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "Users can update own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
      ELSE false
    END
  )
  WITH CHECK (
    CASE 
      WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "Users can delete own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
      ELSE false
    END
  );

-- Add index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);