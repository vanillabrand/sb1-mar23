#!/bin/bash

# Add error handling and logging
set -e
set -o pipefail

# Add logging function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Run pre-deployment checks with better error handling
log_message "Starting pre-deployment checks..."
if ! bash scripts/pre-deploy-check.sh; then
    log_message "ERROR: Pre-deployment checks failed!"
    exit 1
fi

# PM2 deployment with better error handling
log_message "Deploying trading server..."
if pm2 delete trading-server 2>/dev/null; then
    log_message "Removed existing trading-server instance"
fi

if ! pm2 start backend/server.ts \
    --name trading-server \
    --max-memory-restart 1G \
    --node-args="--max-old-space-size=1536 --require ts-node/register" \
    --exp-backoff-restart-delay=100 \
    --restart-delay=5000 \
    --max-restarts=5; then
    
    log_message "ERROR: Failed to start trading-server"
    exit 1
fi

log_message "Deployment successful"

# Monitor logs
pm2 logs trading-server
