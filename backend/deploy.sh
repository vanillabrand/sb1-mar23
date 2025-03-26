#!/bin/bash

# Run pre-deployment checks
if ! bash scripts/pre-deploy-check.sh; then
  echo "Pre-deployment checks failed!"
  exit 1
fi

# Continue with existing deployment steps
# Deploy the background trading process
pm2 delete trading-server || true
pm2 start backend/server.ts --name trading-server \
  --max-memory-restart 1G \
  --node-args="--max-old-space-size=1536" \
  --exp-backoff-restart-delay=100 \
  --restart-delay=5000 \
  --max-restarts=5

# Monitor logs
pm2 logs trading-server
