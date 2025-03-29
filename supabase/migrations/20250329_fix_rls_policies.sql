-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can view their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can update their own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can delete their own strategies" ON strategies;

-- Enable RLS on strategies table if not already enabled
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting strategies
CREATE POLICY "Users can create their own strategies"
ON strategies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for viewing strategies
CREATE POLICY "Users can view their own strategies"
ON strategies
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for updating strategies
CREATE POLICY "Users can update their own strategies"
ON strategies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for deleting strategies
CREATE POLICY "Users can delete their own strategies"
ON strategies
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);