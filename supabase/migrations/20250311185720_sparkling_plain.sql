/*
  # Create Bug Reports Table

  1. New Tables
    - `bug_reports`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `status` (text)
      - `priority` (text)
      - `reported_by` (uuid, references auth.users)
      - `assigned_to` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for bug report management
*/

-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX bug_reports_status_idx ON bug_reports(status);
CREATE INDEX bug_reports_priority_idx ON bug_reports(priority);
CREATE INDEX bug_reports_reported_by_idx ON bug_reports(reported_by);
CREATE INDEX bug_reports_created_at_idx ON bug_reports(created_at);

-- Enable RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view bug reports"
  ON bug_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create bug reports"
  ON bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can update their own bug reports"
  ON bug_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reported_by OR auth.uid() = assigned_to);

-- Create updated_at trigger
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();