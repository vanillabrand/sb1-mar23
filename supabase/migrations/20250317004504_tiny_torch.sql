/*
  # Create User Notes Table

  1. New Tables
    - `user_notes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `content` (text, max 1000 chars)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Add indexes for performance
*/

-- Drop existing indexes if they exist
DO $$ 
BEGIN
  DROP INDEX IF EXISTS user_notes_user_id_idx;
  DROP INDEX IF EXISTS user_notes_created_at_idx;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create user_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) <= 1000),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes with IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created_at ON user_notes(created_at);

-- Enable RLS
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own notes" ON user_notes;
  DROP POLICY IF EXISTS "Users can create their own notes" ON user_notes;
  DROP POLICY IF EXISTS "Users can update their own notes" ON user_notes;
  DROP POLICY IF EXISTS "Users can delete their own notes" ON user_notes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Users can view their own notes"
  ON user_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON user_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON user_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON user_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
DO $$ 
BEGIN
  CREATE TRIGGER update_user_notes_updated_at
    BEFORE UPDATE ON user_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;