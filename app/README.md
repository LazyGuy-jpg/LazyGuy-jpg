# Ilyost Voice API Platform

A professional Voice API platform built with Node.js, Asterisk ARI, React, and modern web technologies.

## Features

### User Portal
- **Dashboard**: Real-time call statistics, balance tracking, and API status
- **Call Management**: Detailed call logs with billing information
- **Payment System**: Cryptocurrency payments via NOWPayments with bonus rules
- **API Documentation**: Interactive documentation for developers
- **Account Management**: Profile settings and API key management

### Admin Portal
- **Analytics Dashboard**: System-wide statistics and revenue tracking
- **User Management**: API key creation, user registration management
- **Pricing Management**: Country-based pricing with billing increments
- **Bonus Rules**: Configurable bonus system for payments
- **System Settings**: Registration control, maintenance mode, etc.

### Voice API Features
- **Call Creation**: Initiate outbound calls with callback URLs
- **Text-to-Speech**: Play dynamic text with Azure TTS
- **DTMF Collection**: Gather user input via phone keypad
- **Audio Playback**: Play pre-recorded audio files
- **Call Control**: Hold, unhold, transfer, and hangup calls
- **AMD Detection**: Answering Machine Detection
- **Call Recording**: Automatic call recording with download links

## Tech Stack

- **Backend**: Node.js, Express, Sequelize ORM
- **Voice Engine**: Asterisk with ARI (Asterisk REST Interface)
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand
- **Database**: SQLite (easily switchable to PostgreSQL/MySQL)
- **Payment**: NOWPayments cryptocurrency gateway
- **TTS**: Azure Cognitive Services
- **Process Manager**: PM2
- **Web Server**: Nginx

## Prerequisites

- Ubuntu/Debian Linux server
- Node.js 18+ and npm
- Asterisk 16+ with ARI enabled
- Nginx
- Domain names pointed to your server:
  - ilyost.com (main site)
  - webapi.ilyost.com (API endpoints)

## Installation

### 1. Clone and Setup

```bash
# Clone the repository to /root/app
cd /root
git clone <repository-url> app
cd app

# Copy your backend files
cp main.js helpers.js config.js webapi.js /root/app/

# Make deploy script executable
chmod +x deploy.sh
```

### 2. Configure the Application

Edit `config.js` with your credentials:

```javascript
module.exports = {
  // Admin secret for admin panel access
  ADMIN_SECRET: 'your-secure-admin-secret',
  
  // Session secret
  sessionSecret: 'your-session-secret',
  
  // Asterisk ARI configuration
  ari: {
    url: 'http://your-asterisk-server:8088',
    username: 'your-ari-username',
    password: 'your-ari-password',
  },
  
  // Azure TTS configuration
  azureTts: {
    apiKey: 'your-azure-tts-key',
    region: 'your-azure-region',
  },
  
  // NOWPayments configuration
  nowpayments: {
    apiKey: 'your-nowpayments-api-key',
    ipnSecret: 'your-ipn-secret',
    callbackUrl: 'https://webapi.ilyost.com/nowpayments-ipn',
  },
  
  // Update URLs for production
  apiBaseUrl: 'https://ilyost.com',
  frontendUrl: 'https://ilyost.com',
};
```

### 3. Install Dependencies

```bash
# Install backend dependencies
cd /root/app
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 4. Build Frontend

```bash
cd /root/app/frontend
npm run build
```

### 5. Deploy

Run the deployment script as root:

```bash
cd /root/app
sudo ./deploy.sh
```

This will:
- Install all dependencies
- Build the React frontend
- Configure Nginx
- Set up SSL certificates with Let's Encrypt
- Start the backend with PM2
- Set up necessary directories and permissions

## Manual Setup (Alternative)

If you prefer manual setup:

### Backend Setup

```bash
cd /root/app
npm install
pm2 start main.js --name ilyost-backend
pm2 save
pm2 startup
```

### Frontend Build

```bash
cd /root/app/frontend
npm install
npm run build
```

### Nginx Configuration

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/ilyost
sudo ln -s /etc/nginx/sites-available/ilyost /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Setup

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d ilyost.com -d www.ilyost.com
sudo certbot --nginx -d webapi.ilyost.com
```

## API Endpoints

### Main Site (ilyost.com)
- `/api/login` - User login
- `/api/register` - User registration
- `/api/user/*` - User endpoints
- `/api/admin/*` - Admin endpoints
- `/api/create-payment` - Payment creation
- `/api/nowpayments-ipn` - Payment webhook

### Web API (webapi.ilyost.com)
- `/v2/create-call` - Create outbound call
- `/v2/play-text` - Play TTS audio
- `/v2/gather-text` - Gather DTMF with TTS prompt
- `/v2/play-audio` - Play audio file
- `/v2/gather-audio` - Gather DTMF with audio prompt
- `/v2/transfer` - Transfer call
- `/v2/hold` - Put call on hold
- `/v2/unhold` - Resume call
- `/v2/hangup` - End call
- `/v2/balance` - Check balance
- `/recording` - Download call recordings

## Default Credentials

After installation, use these to access the admin panel:

1. Navigate to `https://ilyost.com/admin/login`
2. Use the admin secret configured in `config.js`

## Managing the Application

### View Logs
```bash
# Backend logs
pm2 logs ilyost-backend

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# All PM2 processes
pm2 status
```

### Restart Services
```bash
# Restart backend
pm2 restart ilyost-backend

# Restart Nginx
sudo systemctl restart nginx
```

### Update Application
```bash
cd /root/app
git pull
npm install
cd frontend
npm install
npm run build
pm2 restart ilyost-backend
```

## Troubleshooting

### Backend Won't Start
- Check logs: `pm2 logs ilyost-backend`
- Verify database file permissions
- Ensure Asterisk ARI is accessible

### Frontend 404 Errors
- Verify nginx configuration
- Check if frontend build completed: `ls -la /root/app/frontend/dist`
- Ensure nginx user can read files

### Payment Issues
- Verify NOWPayments API credentials
- Check IPN webhook URL is accessible
- Review payment logs in admin panel

### SSL Certificate Issues
- Ensure domains point to server
- Check firewall allows ports 80/443
- Manually renew: `sudo certbot renew`

## Security Recommendations

1. **Change Default Secrets**: Update all secrets in `config.js`
2. **Firewall**: Configure UFW or iptables
3. **Regular Updates**: Keep system and dependencies updated
4. **Backup**: Regular database backups
5. **Monitoring**: Set up monitoring for uptime and performance

## Support

For issues or questions:
- Email: support@ilyost.com
- Documentation: https://ilyost.com/documentation

## License

Proprietary - All rights reserved