# 🚀 Quick Start Guide

Get your Asterisk ARI React Dashboard running in under 5 minutes!

## Option 1: Quick Demo (Recommended for Testing)

### Windows Users:
1. Double-click `start-demo.bat`
2. Wait for the installation and startup process
3. Your browser will open to `http://localhost:3000`

### Mac/Linux Users:
1. Run: `./start-demo.sh`
2. Wait for the installation and startup process  
3. Your browser will open to `http://localhost:3000`

### Manual Demo Start:
```bash
# Install dependencies
npm install

# Start demo server (in one terminal)
node demo-server.js

# Start React app (in another terminal)
npm run dev
```

## Option 2: Connect to Your Asterisk Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your backend URL:**
   Edit `src/services/asteriskAPI.js`:
   ```javascript
   const API_BASE_URL = 'http://your-asterisk-server:8080/api'
   ```

3. **Update Socket.IO connection:**
   Edit `src/contexts/AsteriskContext.jsx`:
   ```javascript
   const socket = io('http://your-asterisk-server:8080')
   ```

4. **Start the React app:**
   ```bash
   npm run dev
   ```

## What You'll See

The dashboard includes:

- **📊 Dashboard** - Real-time statistics and overview
- **📞 Channels** - Active call management
- **🌉 Bridges** - Conference bridge management  
- **📋 Endpoints** - SIP/PJSIP endpoint monitoring
- **🎙️ Recordings** - Call recording management
- **📱 Applications** - ARI application monitoring
- **🖥️ System Info** - Asterisk system information
- **📜 Call Logs** - Call history with filtering

## Demo Features

The demo server provides realistic sample data to showcase all features:

- ✅ Mock channels with different states
- ✅ Sample bridges and endpoints
- ✅ Fake recordings and call logs
- ✅ Real-time updates via Socket.IO
- ✅ Interactive operations (create/delete)

## Troubleshooting

### Port Already in Use
If you get port errors:
```bash
# Kill processes on ports 3000 and 8080
npx kill-port 3000 8080
```

### Dependencies Issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Browser Not Opening
Manually visit: `http://localhost:3000`

## Next Steps

1. **Explore the demo** - Click around and test features
2. **Review the code** - Check out the React components  
3. **Integrate your backend** - Replace demo API with your real endpoints
4. **Customize** - Modify colors, layout, or add new features

## Need Help?

- Check the full `README.md` for detailed documentation
- Review the API structure in `demo-server.js`
- Look at component files in `src/pages/` for examples

---

🎉 **That's it!** You now have a fully functional Asterisk ARI dashboard running locally.