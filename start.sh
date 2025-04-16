#!/bin/bash

# Kill any existing processes on port 3003 and 5173
echo "Killing any existing processes on ports 3003 and 5173..."
lsof -ti:3003 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start the proxy server
echo "Starting proxy server..."
node proxy-server.js &
PROXY_PID=$!

# Wait for the proxy server to start
echo "Waiting for proxy server to start..."
sleep 2

# Start the web application
echo "Starting web application..."
npm run dev &
WEB_PID=$!

# Function to handle script termination
cleanup() {
  echo "Shutting down servers..."
  kill $PROXY_PID 2>/dev/null
  kill $WEB_PID 2>/dev/null
  exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running
echo "Both servers are running. Press Ctrl+C to stop."
wait
