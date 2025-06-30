// Demo server for testing the React Asterisk ARI Dashboard
// This simulates the backend API without requiring a real Asterisk installation

const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
})

app.use(cors())
app.use(express.json())

// Mock data
let mockData = {
  channels: [
    {
      id: 'PJSIP/1001-00000001',
      name: 'PJSIP/1001-00000001',
      state: 'Up',
      caller: { name: 'John Doe', number: '1001' },
      connected: { name: 'Jane Smith', number: '1002' },
      creationtime: new Date().toISOString(),
      bridges: []
    },
    {
      id: 'PJSIP/1002-00000002',
      name: 'PJSIP/1002-00000002',
      state: 'Ringing',
      caller: { name: 'Bob Wilson', number: '1003' },
      connected: { name: 'Alice Brown', number: '1004' },
      creationtime: new Date(Date.now() - 30000).toISOString(),
      bridges: []
    }
  ],
  bridges: [
    {
      id: 'bridge-001',
      name: 'Conference Bridge',
      bridge_type: 'mixing',
      technology: 'native_rtp',
      channels: ['PJSIP/1001-00000001'],
      creationtime: new Date().toISOString()
    }
  ],
  endpoints: [
    {
      technology: 'PJSIP',
      resource: '1001',
      state: 'online',
      channel_ids: ['PJSIP/1001-00000001']
    },
    {
      technology: 'PJSIP',
      resource: '1002',
      state: 'online',
      channel_ids: ['PJSIP/1002-00000002']
    },
    {
      technology: 'PJSIP',
      resource: '1003',
      state: 'offline',
      channel_ids: []
    }
  ],
  recordings: [
    {
      name: 'recording_001_1703123456',
      state: 'done',
      duration: 125,
      format: 'wav',
      size: 2048576,
      created_time: new Date(Date.now() - 3600000).toISOString()
    },
    {
      name: 'recording_002_1703123789',
      state: 'recording',
      format: 'wav',
      created_time: new Date().toISOString()
    }
  ],
  applications: [
    {
      name: 'demo-app',
      channel_ids: ['PJSIP/1001-00000001']
    },
    {
      name: 'voicemail',
      channel_ids: []
    }
  ],
  systemInfo: {
    version: 'Asterisk 20.5.0',
    build_options: 'standard',
    uptime: '5 days, 3 hours, 22 minutes',
    load_average: '0.15, 0.18, 0.20',
    memory_usage: '2.1GB / 8GB',
    cpu_usage: '15%',
    database_type: 'MySQL',
    database_status: 'Connected',
    bind_address: '0.0.0.0',
    http_port: '8088',
    modules: ['res_ari', 'res_pjsip', 'app_dial', 'app_playback', 'chan_pjsip']
  },
  callLogs: [
    {
      callId: 'call-001',
      caller: '1001',
      callee: '1002',
      status: 'answered',
      startTime: new Date(Date.now() - 1800000).toISOString(),
      endTime: new Date(Date.now() - 1740000).toISOString(),
      duration: 60,
      direction: 'inbound'
    },
    {
      callId: 'call-002',
      caller: '1003',
      callee: '1001',
      status: 'failed',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      duration: 0,
      direction: 'outbound'
    }
  ]
}

// API Routes
app.get('/api/channels', (req, res) => {
  res.json(mockData.channels)
})

app.get('/api/bridges', (req, res) => {
  res.json(mockData.bridges)
})

app.get('/api/endpoints', (req, res) => {
  res.json(mockData.endpoints)
})

app.get('/api/recordings', (req, res) => {
  res.json(mockData.recordings)
})

app.get('/api/applications', (req, res) => {
  res.json(mockData.applications)
})

app.get('/api/system/info', (req, res) => {
  res.json(mockData.systemInfo)
})

app.get('/api/call-logs', (req, res) => {
  res.json(mockData.callLogs)
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Channel operations
app.delete('/api/channels/:id', (req, res) => {
  const channelId = req.params.id
  mockData.channels = mockData.channels.filter(ch => ch.id !== channelId)
  
  // Emit socket event
  io.emit('channelDestroyed', channelId)
  
  res.json({ success: true })
})

app.post('/api/channels', (req, res) => {
  const newChannel = {
    id: `PJSIP/${req.body.endpoint}-${Date.now()}`,
    name: `PJSIP/${req.body.endpoint}-${Date.now()}`,
    state: 'Ringing',
    caller: { number: req.body.endpoint },
    creationtime: new Date().toISOString(),
    bridges: []
  }
  
  mockData.channels.push(newChannel)
  
  // Emit socket event
  io.emit('channelCreated', newChannel)
  
  res.json(newChannel)
})

// Bridge operations
app.post('/api/bridges', (req, res) => {
  const newBridge = {
    id: `bridge-${Date.now()}`,
    name: req.body.name || `Bridge ${Date.now()}`,
    bridge_type: req.body.type || 'mixing',
    technology: 'native_rtp',
    channels: [],
    creationtime: new Date().toISOString()
  }
  
  mockData.bridges.push(newBridge)
  
  // Emit socket event
  io.emit('bridgeCreated', newBridge)
  
  res.json(newBridge)
})

app.delete('/api/bridges/:id', (req, res) => {
  const bridgeId = req.params.id
  mockData.bridges = mockData.bridges.filter(br => br.id !== bridgeId)
  
  // Emit socket event
  io.emit('bridgeDestroyed', bridgeId)
  
  res.json({ success: true })
})

// Recording operations
app.post('/api/recordings/:name/stop', (req, res) => {
  const recordingName = req.params.name
  const recording = mockData.recordings.find(r => r.name === recordingName)
  if (recording) {
    recording.state = 'done'
    recording.duration = Math.floor(Math.random() * 300) + 30 // Random duration
  }
  res.json({ success: true })
})

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  // Simulate some real-time events
  setInterval(() => {
    // Simulate channel state changes
    if (mockData.channels.length > 0) {
      const randomChannel = mockData.channels[Math.floor(Math.random() * mockData.channels.length)]
      socket.emit('channelStateChange', randomChannel)
    }
  }, 10000)
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 8080

server.listen(PORT, () => {
  console.log(`🚀 Demo Asterisk ARI Server running on port ${PORT}`)
  console.log(`📊 Dashboard will be available at http://localhost:3000`)
  console.log(`🔧 API endpoints available at http://localhost:${PORT}/api`)
  console.log('')
  console.log('📋 Available endpoints:')
  console.log('  GET  /api/channels')
  console.log('  GET  /api/bridges') 
  console.log('  GET  /api/endpoints')
  console.log('  GET  /api/recordings')
  console.log('  GET  /api/applications')
  console.log('  GET  /api/system/info')
  console.log('  GET  /api/call-logs')
  console.log('  GET  /api/health')
  console.log('')
  console.log('🔴 To stop the server, press Ctrl+C')
})