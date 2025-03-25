/*
  # Add Token Rewards System

  1. New Tables
    - `user_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `balance` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `token_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `amount` (numeric)
      - `type` (text)
      - `description` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to view their own data
    - Add policies for system to manage token balances
*/

-- Create user_tokens table
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  balance numeric NOT NULL DEFAULT 20000000, -- Start with 20M tokens
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create token_transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_transaction_type CHECK (type IN ('reward', 'spend', 'bonus', 'system'))
);

-- Enable RLS
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_tokens
CREATE POLICY "Users can view their own token balance"
  ON user_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for token_transactions
CREATE POLICY "Users can view their own transactions"
  ON token_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to handle new user token balance
CREATE OR REPLACE FUNCTION public.handle_new_user_tokens()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_tokens (user_id)
  VALUES (NEW.id);
  
  -- Add initial token transaction
  INSERT INTO public.token_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 20000000, 'system', 'Initial token allocation');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user token balance
CREATE OR REPLACE TRIGGER on_auth_user_created_tokens
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tokens();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tokens_updated_at();