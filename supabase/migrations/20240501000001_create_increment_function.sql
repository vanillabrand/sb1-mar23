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
