/*
  # Fix Strategy Policies

  1. Changes
    - Drop and recreate policies for strategies table
    - Add proper error handling for existing policies
    - Ensure policies are created only if they don't exist
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view all strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can create strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies only if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'strategies' 
    AND policyname = 'Users can view all strategies'
  ) THEN
    CREATE POLICY "Users can view all strategies"
      ON strategies
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'strategies' 
    AND policyname = 'Users can create strategies'
  ) THEN
    CREATE POLICY "Users can create strategies"
      ON strategies
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'strategies' 
    AND policyname = 'Users can update their own strategies'
  ) THEN
    CREATE POLICY "Users can update their own strategies"
      ON strategies
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'strategies' 
    AND policyname = 'Users can delete their own strategies'
  ) THEN
    CREATE POLICY "Users can delete their own strategies"
      ON strategies
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;