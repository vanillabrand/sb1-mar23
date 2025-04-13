-- Drop existing policies
DROP POLICY IF EXISTS "Templates are viewable by everyone" ON strategy_templates;
DROP POLICY IF EXISTS "System can create templates" ON strategy_templates;
DROP POLICY IF EXISTS "Template owners can update their templates" ON strategy_templates;
DROP POLICY IF EXISTS "Template owners can delete their templates" ON strategy_templates;

-- Create new policies
CREATE POLICY "Anyone can view templates"
  ON strategy_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create templates"
  ON strategy_templates
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update templates"
  ON strategy_templates
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete templates"
  ON strategy_templates
  FOR DELETE
  USING (true);
