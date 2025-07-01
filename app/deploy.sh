#!/bin/bash

# Deployment script for Ilyost Voice API Platform

set -e

echo "Starting deployment..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Variables
APP_DIR="/root/app"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/ilyost"
PM2_NAME="ilyost-backend"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Step 1: Installing backend dependencies...${NC}"
cd $APP_DIR
npm install --production

echo -e "${GREEN}Step 2: Building frontend...${NC}"
cd $FRONTEND_DIR
npm install
npm run build

echo -e "${GREEN}Step 3: Setting up Nginx configuration...${NC}"
cp $APP_DIR/nginx.conf $NGINX_CONF
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/ilyost

# Test nginx configuration
nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Nginx configuration is valid${NC}"
    systemctl reload nginx
else
    echo -e "${RED}Nginx configuration is invalid!${NC}"
    exit 1
fi

echo -e "${GREEN}Step 4: Setting up PM2 process manager...${NC}"
# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Stop existing process if running
pm2 stop $PM2_NAME 2>/dev/null || true
pm2 delete $PM2_NAME 2>/dev/null || true

# Start the backend with PM2
cd $APP_DIR
pm2 start main.js --name $PM2_NAME --max-memory-restart 1G

# Save PM2 configuration
pm2 save
pm2 startup systemd -u root --hp /root

echo -e "${GREEN}Step 5: Setting up SSL certificates...${NC}"
# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Request certificates for both domains
echo "Requesting SSL certificate for ilyost.com..."
certbot --nginx -d ilyost.com -d www.ilyost.com --non-interactive --agree-tos --email admin@ilyost.com || true

echo "Requesting SSL certificate for webapi.ilyost.com..."
certbot --nginx -d webapi.ilyost.com --non-interactive --agree-tos --email admin@ilyost.com || true

echo -e "${GREEN}Step 6: Setting up cron jobs...${NC}"
# Add cron job for SSL renewal
(crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet") | crontab -

echo -e "${GREEN}Step 7: Creating necessary directories...${NC}"
mkdir -p /var/spool/asterisk/recording
mkdir -p /var/lib/asterisk/sounds
mkdir -p $APP_DIR/uploads
chown -R asterisk:asterisk /var/spool/asterisk/recording /var/lib/asterisk/sounds

echo -e "${GREEN}Step 8: Setting permissions...${NC}"
chmod +x $APP_DIR/deploy.sh
chmod -R 755 $FRONTEND_DIR/dist

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Application URLs:"
echo "- Main site: https://ilyost.com"
echo "- API endpoints: https://webapi.ilyost.com"
echo ""
echo "To view logs:"
echo "- Backend logs: pm2 logs $PM2_NAME"
echo "- Nginx logs: tail -f /var/log/nginx/error.log"
echo ""
echo "To manage the application:"
echo "- pm2 status"
echo "- pm2 restart $PM2_NAME"
echo "- pm2 stop $PM2_NAME"