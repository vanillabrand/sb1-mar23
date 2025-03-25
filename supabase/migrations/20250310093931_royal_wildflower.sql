/*
  # Add Transaction History Tables

  1. New Tables
    - `transaction_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `strategy_id` (uuid, foreign key to strategies)
      - `type` (text - trade, deposit, withdrawal)
      - `amount` (numeric)
      - `balance_before` (numeric)
      - `balance_after` (numeric)
      - `description` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on transaction_history table
    - Add policies for user access control

  3. Changes
    - Add trigger for automatic timestamp updates
    - Use auth.users instead of users table for foreign key
*/

-- Create transaction history table
CREATE TABLE IF NOT EXISTS transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES strategies(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal')),
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX transaction_history_user_id_idx ON transaction_history(user_id);
CREATE INDEX transaction_history_strategy_id_idx ON transaction_history(strategy_id);
CREATE INDEX transaction_history_created_at_idx ON transaction_history(created_at);

-- Enable RLS
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own transactions"
  ON transaction_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transaction_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transaction_history_updated_at
  BEFORE UPDATE ON transaction_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();