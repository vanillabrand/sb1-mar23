-- Create function to increment error count
CREATE OR REPLACE FUNCTION increment_error_count()
RETURNS integer
LANGUAGE sql
AS $$
  SELECT COALESCE(error_count, 0) + 1
  FROM background_processes
  WHERE process_id = auth.uid();
$$;