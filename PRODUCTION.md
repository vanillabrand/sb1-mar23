# Production Deployment Guide

This document provides instructions for deploying the Trading App to a production environment.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- PM2 (for process management)
- Apache 2.4 or higher with mod_proxy, mod_proxy_http, mod_proxy_wss, and mod_rewrite enabled
- SSL certificate for your domain

## Environment Setup

1. Clone the repository to your local machine or deployment server:
   ```bash
   git clone https://github.com/yourusername/trading-app.git
   cd trading-app
   ```

2. Create a production environment file:
   ```bash
   cp .env.production.template .env.production
   ```

3. Edit the `.env.production` file and fill in all required values:
   - API keys for DeepSeek, Coindesk, and other services
   - Supabase URL and anonymous key
   - Exchange API URLs
   - Production domain and WebSocket URLs

## Building for Production

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Test the production build locally:
   ```bash
   npm run preview
   ```

## Server Configuration

### Apache Configuration

1. Install Apache and required modules:
   ```bash
   sudo apt update
   sudo apt install apache2
   sudo a2enmod proxy proxy_http proxy_wss rewrite ssl headers
   ```

2. Copy the Apache configuration file:
   ```bash
   sudo cp apache-config.conf /etc/apache2/sites-available/trading-app.conf
   ```

3. Edit the configuration file to match your domain and SSL certificate paths:
   ```bash
   sudo nano /etc/apache2/sites-available/trading-app.conf
   ```

4. Enable the site:
   ```bash
   sudo a2ensite trading-app.conf
   sudo systemctl reload apache2
   ```

### SSL Certificate

1. If you don't have an SSL certificate, you can obtain one using Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-apache
   sudo certbot --apache -d trading-app.example.com
   ```

## Deployment

You can use the provided deployment script to automate the deployment process:

1. Make the script executable:
   ```bash
   chmod +x deploy-production.sh
   ```

2. Run the deployment script:
   ```bash
   sudo ./deploy-production.sh
   ```

The script will:
- Install dependencies
- Build the application
- Create a backup of the current deployment
- Deploy the application to the configured directory
- Set up PM2 to manage the proxy server
- Configure PM2 to start on system boot
- Set appropriate permissions
- Restart Apache

## Manual Deployment

If you prefer to deploy manually:

1. Build the application:
   ```bash
   npm ci
   npm run build
   ```

2. Copy the built files to your web server:
   ```bash
   sudo mkdir -p /var/www/html/trading-app
   sudo cp -r dist/* /var/www/html/trading-app/
   ```

3. Set up the proxy server:
   ```bash
   sudo mkdir -p /var/www/html/trading-app/server
   sudo cp proxy-server.js ecosystem.config.js package.json package-lock.json .env.production /var/www/html/trading-app/server/
   cd /var/www/html/trading-app/server
   sudo mv .env.production .env
   sudo npm ci --production
   ```

4. Start the proxy server with PM2:
   ```bash
   sudo pm2 start ecosystem.config.js --env production
   sudo pm2 save
   sudo pm2 startup
   ```

5. Set appropriate permissions:
   ```bash
   sudo chown -R www-data:www-data /var/www/html/trading-app
   ```

6. Restart Apache:
   ```bash
   sudo systemctl restart apache2
   ```

## Monitoring and Maintenance

### PM2 Commands

- Check status of all processes:
  ```bash
  pm2 status
  ```

- View logs:
  ```bash
  pm2 logs
  ```

- Restart processes:
  ```bash
  pm2 restart all
  ```

- Stop processes:
  ```bash
  pm2 stop all
  ```

### Apache Commands

- Check Apache status:
  ```bash
  sudo systemctl status apache2
  ```

- View Apache error logs:
  ```bash
  sudo tail -f /var/log/apache2/trading-app-ssl-error.log
  ```

- View Apache access logs:
  ```bash
  sudo tail -f /var/log/apache2/trading-app-ssl-access.log
  ```

## Troubleshooting

### WebSocket Connection Issues

If WebSocket connections are failing:

1. Ensure mod_proxy_wss is enabled:
   ```bash
   sudo a2enmod proxy_wss
   sudo systemctl restart apache2
   ```

2. Check that the WebSocket proxy configuration is correct in the Apache config.

3. Verify that the proxy server is running and listening on the correct port:
   ```bash
   pm2 status
   netstat -tulpn | grep 3001
   ```

### API Connection Issues

If API requests are failing:

1. Check the proxy server logs:
   ```bash
   pm2 logs
   ```

2. Verify that the proxy configuration in Apache is correct.

3. Ensure that the environment variables are properly set in the .env file.

### Performance Issues

If the application is slow:

1. Check server resource usage:
   ```bash
   top
   free -m
   df -h
   ```

2. Consider increasing the resources allocated to PM2:
   ```bash
   pm2 update
   ```

3. Optimize Apache configuration for better performance.

## Backup and Recovery

Regular backups are essential. The deployment script creates backups automatically, but you can also create manual backups:

```bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
sudo tar -czf "/var/www/backups/trading-app-$TIMESTAMP.tar.gz" -C /var/www/html trading-app
```

To restore from a backup:

```bash
sudo rm -rf /var/www/html/trading-app
sudo mkdir -p /var/www/html/trading-app
sudo tar -xzf /var/www/backups/trading-app-TIMESTAMP.tar.gz -C /var/www/html
sudo chown -R www-data:www-data /var/www/html/trading-app
sudo systemctl restart apache2
```
