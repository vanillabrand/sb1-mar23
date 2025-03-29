-- Add selectedPairs column to strategies table
ALTER TABLE strategies 
ADD COLUMN IF NOT EXISTS selected_pairs jsonb DEFAULT '[]'::jsonb;

-- Update existing rows if needed
UPDATE strategies 
SET selected_pairs = '[]'::jsonb 
WHERE selected_pairs IS NULL;