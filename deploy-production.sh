#!/bin/bash

# Production Deployment Script for Trading App
# This script builds and deploys the application to a production environment

set -e  # Exit on any error

# Configuration
APP_NAME="trading-app"
DEPLOY_DIR="/var/www/html/$APP_NAME"
BACKUP_DIR="/var/www/backups/$APP_NAME"
LOG_FILE="./deployment.log"
NODE_ENV="production"
PM2_CONFIG="ecosystem.config.js"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Error handler
handle_error() {
  log "ERROR: Deployment failed at line $1"
  exit 1
}

# Set error trap
trap 'handle_error $LINENO' ERR

log "Starting deployment process for $APP_NAME"

# Check if .env.production exists
if [ ! -f .env.production ]; then
  log "ERROR: .env.production file not found. Please create it with the required environment variables."
  exit 1
fi

# Install dependencies
log "Installing dependencies..."
npm ci --production

# Build the application
log "Building application..."
npm run build

# Create backup of current deployment if it exists
if [ -d "$DEPLOY_DIR" ]; then
  log "Creating backup of current deployment..."
  mkdir -p $BACKUP_DIR
  tar -czf "$BACKUP_DIR/$APP_NAME-$TIMESTAMP.tar.gz" -C $(dirname $DEPLOY_DIR) $(basename $DEPLOY_DIR)
fi

# Ensure deploy directory exists
mkdir -p $DEPLOY_DIR

# Deploy the application
log "Deploying application..."
# Copy the built files to the deployment directory
cp -r dist/* $DEPLOY_DIR/

# Copy server files
log "Deploying server files..."
mkdir -p $DEPLOY_DIR/server
cp proxy-server.js $DEPLOY_DIR/server/
cp $PM2_CONFIG $DEPLOY_DIR/server/
cp package.json $DEPLOY_DIR/server/
cp package-lock.json $DEPLOY_DIR/server/
cp .env.production $DEPLOY_DIR/server/.env

# Install server dependencies
log "Installing server dependencies..."
cd $DEPLOY_DIR/server
npm ci --production

# Update PM2 configuration for production
log "Updating PM2 configuration..."
cat > $DEPLOY_DIR/server/ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: '$APP_NAME-proxy',
      script: 'proxy-server.js',
      env: {
        NODE_ENV: 'production',
        PROXY_PORT: 3001
      },
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      combine_logs: true,
      error_file: './logs/proxy-error.log',
      out_file: './logs/proxy-out.log'
    }
  ]
};
EOF

# Create logs directory
mkdir -p $DEPLOY_DIR/server/logs

# Restart the application with PM2
log "Restarting application with PM2..."
cd $DEPLOY_DIR/server
pm2 delete $APP_NAME-proxy 2>/dev/null || true
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot if not already done
pm2 startup | tail -n 1 > startup_command.txt
log "If this is the first deployment, run the command in startup_command.txt to enable PM2 startup on boot"

# Set proper permissions
log "Setting permissions..."
chown -R www-data:www-data $DEPLOY_DIR

# Restart Apache
log "Restarting Apache..."
systemctl restart apache2

log "Deployment completed successfully!"
log "Application is now running at https://trading-app.example.com"
