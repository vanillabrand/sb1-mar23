/*
  # Add strategy configuration column

  1. Changes
    - Add JSONB column `strategy_config` to strategies table to store the AI-generated strategy configuration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'strategies' AND column_name = 'strategy_config'
  ) THEN
    ALTER TABLE strategies ADD COLUMN strategy_config JSONB;
  END IF;
END $$;