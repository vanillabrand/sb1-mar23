-- First, drop existing policies to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can create own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can update own strategies" ON strategies;
  DROP POLICY IF EXISTS "Users can delete own strategies" ON strategies;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Make sure RLS is enabled
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Create simplified but secure policies
CREATE POLICY "Users can view own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    auth.role() = 'authenticated'
  );

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