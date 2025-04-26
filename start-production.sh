#!/bin/bash

# Production Start Script for Trading App
# This script starts the application in production mode

set -e  # Exit on any error

# Configuration
APP_NAME="trading-app"
LOG_FILE="./production.log"

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Error handler
handle_error() {
  log "ERROR: Startup failed at line $1"
  exit 1
}

# Set error trap
trap 'handle_error $LINENO' ERR

log "Starting $APP_NAME in production mode"

# Check if .env file exists
if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    log "Copying .env.production to .env"
    cp .env.production .env
  else
    log "ERROR: No .env or .env.production file found"
    exit 1
  fi
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  log "Installing PM2 globally"
  npm install -g pm2
fi

# Start the proxy server with PM2
log "Starting proxy server with PM2"
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
log "Saving PM2 configuration"
pm2 save

log "Application started successfully in production mode"
log "Use 'pm2 status' to check the status of the application"
log "Use 'pm2 logs' to view the logs"
