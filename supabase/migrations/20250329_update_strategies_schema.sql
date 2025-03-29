-- Update strategies table schema
ALTER TABLE strategies
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN risk_level SET NOT NULL,
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN performance SET DEFAULT 0,
ALTER COLUMN selected_pairs SET DEFAULT '[]'::jsonb,
ALTER COLUMN strategy_config SET DEFAULT '{}'::jsonb;

-- Add constraints
ALTER TABLE strategies
ADD CONSTRAINT strategies_status_check 
CHECK (status IN ('active', 'inactive', 'backend_processing'));

ALTER TABLE strategies
ADD CONSTRAINT strategies_type_check 
CHECK (type IN ('custom', 'template'));