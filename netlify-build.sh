#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Build the frontend
echo "Building frontend..."
npm run build:prod

# Install Netlify Functions dependencies
echo "Installing Netlify Functions dependencies..."
cd netlify/functions
npm install
cd ../..

echo "Build completed successfully!"
