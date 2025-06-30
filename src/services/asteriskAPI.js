import axios from 'axios'

const API_BASE_URL = 'http://localhost:8080/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`Making API request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    const message = error.response?.data?.message || error.message || 'An error occurred'
    throw new Error(message)
  }
)

const asteriskAPI = {
  // Channel operations
  getChannels: () => api.get('/channels'),
  getChannel: (channelId) => api.get(`/channels/${channelId}`),
  hangupChannel: (channelId) => api.delete(`/channels/${channelId}`),
  holdChannel: (channelId) => api.post(`/channels/${channelId}/hold`),
  unholdChannel: (channelId) => api.delete(`/channels/${channelId}/hold`),
  muteChannel: (channelId, direction = 'both') => api.post(`/channels/${channelId}/mute`, { direction }),
  unmuteChannel: (channelId, direction = 'both') => api.delete(`/channels/${channelId}/mute`, { data: { direction } }),
  originateChannel: (data) => api.post('/channels', data),
  answerChannel: (channelId) => api.post(`/channels/${channelId}/answer`),
  
  // Bridge operations
  getBridges: () => api.get('/bridges'),
  getBridge: (bridgeId) => api.get(`/bridges/${bridgeId}`),
  createBridge: (data) => api.post('/bridges', data),
  destroyBridge: (bridgeId) => api.delete(`/bridges/${bridgeId}`),
  addChannelToBridge: (channelId, bridgeId) => api.post(`/bridges/${bridgeId}/addChannel`, { channelId }),
  removeChannelFromBridge: (channelId, bridgeId) => api.post(`/bridges/${bridgeId}/removeChannel`, { channelId }),
  playToBridge: (bridgeId, media) => api.post(`/bridges/${bridgeId}/play`, { media }),
  
  // Endpoint operations
  getEndpoints: () => api.get('/endpoints'),
  getEndpoint: (technology, resource) => api.get(`/endpoints/${technology}/${resource}`),
  
  // Recording operations
  getRecordings: () => api.get('/recordings'),
  getRecording: (recordingName) => api.get(`/recordings/${recordingName}`),
  startRecording: (channelId, recordingName, options = {}) => 
    api.post(`/channels/${channelId}/record`, { name: recordingName, ...options }),
  stopRecording: (recordingName) => api.post(`/recordings/${recordingName}/stop`),
  pauseRecording: (recordingName) => api.post(`/recordings/${recordingName}/pause`),
  unpauseRecording: (recordingName) => api.delete(`/recordings/${recordingName}/pause`),
  deleteRecording: (recordingName) => api.delete(`/recordings/${recordingName}`),
  
  // Application operations
  getApplications: () => api.get('/applications'),
  getApplication: (applicationName) => api.get(`/applications/${applicationName}`),
  
  // System operations
  getSystemInfo: () => api.get('/system/info'),
  getSystemStats: () => api.get('/system/stats'),
  
  // Call logs
  getCallLogs: (params = {}) => api.get('/call-logs', { params }),
  getCallLog: (callId) => api.get(`/call-logs/${callId}`),
  
  // Playback operations
  playSound: (channelId, sound, options = {}) => 
    api.post(`/channels/${channelId}/play`, { media: sound, ...options }),
  stopPlayback: (playbackId) => api.delete(`/playbacks/${playbackId}`),
  
  // DTMF operations
  sendDTMF: (channelId, dtmf, options = {}) => 
    api.post(`/channels/${channelId}/dtmf`, { dtmf, ...options }),
  
  // Snoop operations
  snoopChannel: (channelId, snoopId, options = {}) => 
    api.post(`/channels/${channelId}/snoop`, { snoopId, ...options }),
  
  // Device state operations
  getDeviceStates: () => api.get('/deviceStates'),
  updateDeviceState: (deviceName, deviceState) => 
    api.put(`/deviceStates/${deviceName}`, { deviceState }),
  
  // Mailbox operations
  getMailboxes: () => api.get('/mailboxes'),
  updateMailbox: (mailboxName, oldMessages, newMessages) => 
    api.put(`/mailboxes/${mailboxName}`, { oldMessages, newMessages }),
  
  // Custom operations (these would interface with your webapi.js and helpers.js)
  customOperation: (operationName, data = {}) => 
    api.post(`/custom/${operationName}`, data),
  
  // Health check
  healthCheck: () => api.get('/health'),
  
  // WebSocket connection info
  getWebSocketInfo: () => api.get('/websocket-info'),
}

export default asteriskAPI