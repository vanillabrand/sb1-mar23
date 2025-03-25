/*
  # Fix Strategy RLS Policies

  1. Changes
    - Update RLS policies for strategies table
    - Add policies for authenticated users to:
      - View all strategies
      - Create strategies
      - Update their own strategies
      - Delete their own strategies
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can create their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can view their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Users can view all strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create strategies"
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