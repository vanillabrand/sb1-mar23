#!/bin/bash

# Script to fix template strategies

echo "Running template strategy fix script..."

# Run the SQL script to create the function
echo "Creating database function..."
npx supabase db execute -f supabase/create_strategy_templates_function.sql

# Run the setup script
echo "Running setup script..."
node scripts/setup_strategy_templates.js

echo "Template strategy fix completed!"
