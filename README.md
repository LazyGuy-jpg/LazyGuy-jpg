# Asterisk ARI React Dashboard

A modern, responsive React dashboard for managing Asterisk ARI (Asterisk REST Interface) with real-time updates and comprehensive telephony management features.

## Features

### 📊 Dashboard
- Real-time statistics and metrics
- Active channels and bridges overview
- Call activity monitoring
- Visual charts and analytics

### 📞 Channel Management
- View all active channels
- Hang up, hold, mute/unmute channels
- Start/stop channel recordings
- Originate new channels
- Real-time channel state updates

### 🌉 Bridge Management
- Create and destroy bridges
- Add/remove channels from bridges
- Multiple bridge types (mixing, holding, DTMF events)
- Real-time bridge monitoring

### 📋 Endpoints
- View all configured endpoints
- Endpoint status monitoring (online/offline/busy)
- Grouped by technology (PJSIP, SIP, etc.)
- Detailed endpoint configuration

### 🎙️ Recordings
- Manage call recordings
- Start/stop/pause recordings
- Download completed recordings
- Recording status tracking

### 📱 Applications
- View registered ARI applications
- Monitor application status
- Track channels associated with applications

### 🖥️ System Information
- Asterisk version and build info
- System resources monitoring
- Database configuration
- Network settings
- Loaded modules

### � Call Logs
- Comprehensive call history
- Advanced filtering and search
- Export to CSV
- Call statistics and analytics

## Technology Stack

- **React 18** - Modern React with hooks
- **Material-UI (MUI)** - Professional UI components
- **Vite** - Fast development build tool
- **Socket.IO** - Real-time communication
- **Chart.js** - Data visualization
- **Axios** - HTTP client for API calls
- **date-fns** - Date manipulation

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 16 or higher)
2. **Asterisk** with ARI enabled
3. **Your existing Node.js backend** with:
   - `webapi.js` - Your API handlers
   - `helpers.js` - Your utility functions
   - Socket.IO server for real-time updates

## Installation

1. **Clone or extract the project files**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your backend connection:**
   - Edit `src/services/asteriskAPI.js` to match your API endpoints
   - Edit `src/contexts/AsteriskContext.jsx` to match your Socket.IO events

## Backend Integration

This React application is designed to work with your existing Node.js backend. You'll need to ensure your backend provides:

### REST API Endpoints
```
GET /api/channels          - List all channels
GET /api/bridges          - List all bridges
GET /api/endpoints        - List all endpoints
GET /api/recordings       - List all recordings
GET /api/applications     - List all applications
GET /api/system/info      - System information
GET /api/call-logs        - Call history
POST /api/channels        - Originate channel
DELETE /api/channels/:id  - Hangup channel
POST /api/bridges         - Create bridge
DELETE /api/bridges/:id   - Destroy bridge
... (and more as needed)
```

### Socket.IO Events
```javascript
// Channel events
socket.emit('channelCreated', channel)
socket.emit('channelStateChange', channel)
socket.emit('channelDestroyed', channelId)

// Bridge events
socket.emit('bridgeCreated', bridge)
socket.emit('bridgeDestroyed', bridgeId)

// Call events
socket.emit('callEnded', callLog)
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

Build the application:
```bash
npm run build
```

The built files will be in the `dist` directory.

## Configuration

### API Configuration
Edit `src/services/asteriskAPI.js` to configure your backend URL:
```javascript
const API_BASE_URL = 'http://your-backend-server:8080/api'
```

### Proxy Configuration
The Vite configuration includes proxy settings for development. Edit `vite.config.js` to match your backend:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  }
}
```

## Features Overview

### Real-time Updates
- Automatic connection to Socket.IO server
- Real-time channel state changes
- Live bridge updates
- Connection status indicators

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts for different screen sizes
- Touch-friendly controls

### Modern UI/UX
- Material Design components
- Dark/light theme support
- Professional appearance
- Intuitive navigation

## File Structure

```
src/
├── components/
│   └── Layout/
│       └── Layout.jsx          # Main layout with navigation
├── contexts/
│   └── AsteriskContext.jsx     # Global state management
├── pages/
│   ├── Dashboard.jsx           # Main dashboard
│   ├── Channels.jsx           # Channel management
│   ├── Bridges.jsx            # Bridge management
│   ├── Endpoints.jsx          # Endpoint monitoring
│   ├── Recordings.jsx         # Recording management
│   ├── Applications.jsx       # ARI applications
│   ├── SystemInfo.jsx         # System information
│   └── CallLogs.jsx           # Call history
├── services/
│   └── asteriskAPI.js         # API service layer
├── App.jsx                    # Main application component
├── main.jsx                   # Application entry point
└── index.css                  # Global styles
```

## Customization

### Adding New Features
1. Create new page components in `src/pages/`
2. Add routes in `src/App.jsx`
3. Update navigation in `src/components/Layout/Layout.jsx`
4. Add API methods in `src/services/asteriskAPI.js`

### Styling
- Global styles in `src/index.css`
- Material-UI theme in `src/main.jsx`
- Component-specific styles using MUI's `sx` prop

## Troubleshooting

### Common Issues

1. **Connection Issues**
   - Verify your backend is running
   - Check API endpoints in browser dev tools
   - Ensure CORS is configured on your backend

2. **Real-time Updates Not Working**
   - Verify Socket.IO server is running
   - Check browser console for connection errors
   - Ensure Socket.IO events match your backend

3. **Build Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
   - Check for any TypeScript errors

## Integration with Your Existing Code

To integrate with your existing `webapi.js` and `helpers.js`:

1. **Update API endpoints** in `asteriskAPI.js` to match your existing routes
2. **Map your data structures** to match what the React components expect
3. **Add Socket.IO events** to your existing WebSocket handlers
4. **Configure CORS** to allow the React app to access your API

## Support

This dashboard is designed to be a starting point that you can customize based on your specific needs. The modular architecture makes it easy to add new features or modify existing ones.

## License

MIT License - feel free to use and modify as needed for your project.

---

# �👋 Hello, I'm **@LazyGuy-jpg**

Welcome, this is my area in the World Wide Web! A lazy developer myself, I prefer creating something that is not too complicated yet works like magic! Despite that, I always deliver quality! So, no complaints there!

---

## 👀 Interests

- 🖥 **Programming**: Loves Python, Node.js, and Asterisk.

- 🌐 **Telco & Automation**: Working on Asterisk and custom IVR systems.

- 🎲 **Creative Construction**: Being a part of any project, right from debugging to feature addition, is my goal.

---

## 🌱 Currently Learning

- 🔧 Trying my hands on **GoLang** for developing performance-centric applications.

---

## 📫 Get in Touch

- 📨 Telegram: [@steroidbackup]

--- 

## ⚡ Fun Fact

- I am a **lazy coder**, but **the highest outputs** are the things that I execute worth. Quality, always comes before quantity! 😎

Please connect with me or go through my projects. In case you think it's worth, do not miss to ⭐ my repos!

--- 

Thanks for sharing your opinion with me! What do you think? 😌

