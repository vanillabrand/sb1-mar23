-- Create user profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Exchange connection fields
  active_exchange jsonb DEFAULT NULL,
  last_connection_status text DEFAULT 'disconnected',
  last_connection_time timestamptz DEFAULT NULL,
  connection_attempts integer DEFAULT 0,
  auto_reconnect boolean DEFAULT true,
  connection_error text DEFAULT NULL,
  
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profiles"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to increment connection attempts
CREATE OR REPLACE FUNCTION increment_connection_attempts(user_id_param uuid)
RETURNS integer AS $$
DECLARE
  current_attempts integer;
BEGIN
  SELECT connection_attempts INTO current_attempts
  FROM public.user_profiles
  WHERE user_id = user_id_param;
  
  RETURN COALESCE(current_attempts, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to update last_connection_time
CREATE OR REPLACE FUNCTION update_last_connection_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_connection_status != OLD.last_connection_status THEN
    NEW.last_connection_time = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_connection_time
DROP TRIGGER IF EXISTS update_last_connection_time_trigger ON public.user_profiles;
CREATE TRIGGER update_last_connection_time_trigger
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
WHEN (NEW.last_connection_status IS DISTINCT FROM OLD.last_connection_status)
EXECUTE FUNCTION update_last_connection_time();
