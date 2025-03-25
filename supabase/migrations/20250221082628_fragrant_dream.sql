/*
  # Update risk level constraint

  1. Changes
    - Modify the valid_risk_level constraint to support additional risk levels
    - Add support for Ultra Low, Ultra High, Extreme, and God Mode risk levels

  2. Notes
    - Uses DO block to safely modify constraint
    - Preserves existing data and policies
*/

DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_risk_level' 
    AND table_name = 'strategies'
  ) THEN
    ALTER TABLE strategies DROP CONSTRAINT valid_risk_level;
  END IF;

  -- Add new constraint with updated risk levels
  ALTER TABLE strategies ADD CONSTRAINT valid_risk_level 
    CHECK (risk_level IN (
      'Ultra Low',
      'Low',
      'Medium',
      'High',
      'Ultra High',
      'Extreme',
      'God Mode'
    ));
END $$;