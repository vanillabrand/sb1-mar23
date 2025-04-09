-- Add active_exchange column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS active_exchange jsonb DEFAULT NULL;

-- Add last_connection_status column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS last_connection_status text DEFAULT 'disconnected';

-- Add last_connection_time column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS last_connection_time timestamptz DEFAULT NULL;

-- Add connection_attempts column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS connection_attempts integer DEFAULT 0;

-- Add auto_reconnect column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS auto_reconnect boolean DEFAULT true;

-- Add connection_error column to user_profiles table
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS connection_error text DEFAULT NULL;

-- Create or replace function to update last_connection_time
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
