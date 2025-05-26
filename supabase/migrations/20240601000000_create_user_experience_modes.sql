-- Create user_experience_modes table to store user experience level preferences
CREATE TABLE IF NOT EXISTS public.user_experience_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  experience_mode text NOT NULL DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'expert'
  onboarding_completed boolean DEFAULT false,
  beginner_tutorial_completed boolean DEFAULT false,
  last_mode_change timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Additional preferences for each mode
  beginner_preferences jsonb DEFAULT '{
    "showTooltips": true,
    "showGuidedHelp": true,
    "simplifiedUI": true,
    "educationalContentLevel": "basic"
  }'::jsonb,
  
  intermediate_preferences jsonb DEFAULT '{
    "showTooltips": true,
    "showGuidedHelp": false,
    "simplifiedUI": false,
    "dashboardLayout": "standard",
    "showAdvancedMetrics": false
  }'::jsonb,
  
  expert_preferences jsonb DEFAULT '{
    "showTooltips": false,
    "showGuidedHelp": false,
    "simplifiedUI": false,
    "dashboardLayout": "advanced",
    "showAdvancedMetrics": true,
    "showAPIOptions": true,
    "enableExperimentalFeatures": false
  }'::jsonb,
  
  CONSTRAINT valid_experience_mode CHECK (experience_mode IN ('beginner', 'intermediate', 'expert')),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_experience_modes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own experience mode settings"
  ON public.user_experience_modes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own experience mode settings"
  ON public.user_experience_modes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own experience mode settings"
  ON public.user_experience_modes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update the updated_at column
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.user_experience_modes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add experience_mode column to user_profiles table if it doesn't exist
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS experience_mode text DEFAULT 'intermediate';

-- Add constraint to user_profiles.experience_mode
ALTER TABLE IF EXISTS public.user_profiles 
ADD CONSTRAINT valid_experience_mode 
CHECK (experience_mode IN ('beginner', 'intermediate', 'expert'));
