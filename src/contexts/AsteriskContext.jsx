import { createContext, useContext, useReducer, useEffect } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import asteriskAPI from '../services/asteriskAPI'

const AsteriskContext = createContext()

const initialState = {
  isConnected: false,
  channels: [],
  bridges: [],
  endpoints: [],
  recordings: [],
  applications: [],
  systemInfo: null,
  callLogs: [],
  stats: {
    activeChannels: 0,
    activeBridges: 0,
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    avgCallDuration: 0
  },
  loading: false,
  error: null
}

function asteriskReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload }
    
    case 'SET_CHANNELS':
      return { 
        ...state, 
        channels: action.payload,
        stats: { 
          ...state.stats, 
          activeChannels: action.payload.length 
        }
      }
    
    case 'ADD_CHANNEL':
      const newChannels = [...state.channels, action.payload]
      return { 
        ...state, 
        channels: newChannels,
        stats: { 
          ...state.stats, 
          activeChannels: newChannels.length 
        }
      }
    
    case 'UPDATE_CHANNEL':
      const updatedChannels = state.channels.map(channel =>
        channel.id === action.payload.id ? action.payload : channel
      )
      return { ...state, channels: updatedChannels }
    
    case 'REMOVE_CHANNEL':
      const filteredChannels = state.channels.filter(channel => channel.id !== action.payload)
      return { 
        ...state, 
        channels: filteredChannels,
        stats: { 
          ...state.stats, 
          activeChannels: filteredChannels.length 
        }
      }
    
    case 'SET_BRIDGES':
      return { 
        ...state, 
        bridges: action.payload,
        stats: { 
          ...state.stats, 
          activeBridges: action.payload.length 
        }
      }
    
    case 'ADD_BRIDGE':
      const newBridges = [...state.bridges, action.payload]
      return { 
        ...state, 
        bridges: newBridges,
        stats: { 
          ...state.stats, 
          activeBridges: newBridges.length 
        }
      }
    
    case 'REMOVE_BRIDGE':
      const filteredBridges = state.bridges.filter(bridge => bridge.id !== action.payload)
      return { 
        ...state, 
        bridges: filteredBridges,
        stats: { 
          ...state.stats, 
          activeBridges: filteredBridges.length 
        }
      }
    
    case 'SET_ENDPOINTS':
      return { ...state, endpoints: action.payload }
    
    case 'SET_RECORDINGS':
      return { ...state, recordings: action.payload }
    
    case 'SET_APPLICATIONS':
      return { ...state, applications: action.payload }
    
    case 'SET_SYSTEM_INFO':
      return { ...state, systemInfo: action.payload }
    
    case 'SET_CALL_LOGS':
      return { ...state, callLogs: action.payload }
    
    case 'ADD_CALL_LOG':
      return { 
        ...state, 
        callLogs: [action.payload, ...state.callLogs],
        stats: {
          ...state.stats,
          totalCalls: state.stats.totalCalls + 1,
          successfulCalls: action.payload.status === 'answered' ? state.stats.successfulCalls + 1 : state.stats.successfulCalls,
          failedCalls: action.payload.status === 'failed' ? state.stats.failedCalls + 1 : state.stats.failedCalls
        }
      }
    
    case 'UPDATE_STATS':
      return { ...state, stats: { ...state.stats, ...action.payload } }
    
    default:
      return state
  }
}

export function AsteriskProvider({ children }) {
  const [state, dispatch] = useReducer(asteriskReducer, initialState)

  useEffect(() => {
    // Initialize socket connection
    const socket = io('http://localhost:8080')

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true })
      toast.success('Connected to Asterisk ARI')
    })

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: false })
      toast.error('Disconnected from Asterisk ARI')
    })

    // Channel events
    socket.on('channelStateChange', (channel) => {
      dispatch({ type: 'UPDATE_CHANNEL', payload: channel })
    })

    socket.on('channelDestroyed', (channelId) => {
      dispatch({ type: 'REMOVE_CHANNEL', payload: channelId })
    })

    socket.on('channelCreated', (channel) => {
      dispatch({ type: 'ADD_CHANNEL', payload: channel })
    })

    // Bridge events
    socket.on('bridgeCreated', (bridge) => {
      dispatch({ type: 'ADD_BRIDGE', payload: bridge })
    })

    socket.on('bridgeDestroyed', (bridgeId) => {
      dispatch({ type: 'REMOVE_BRIDGE', payload: bridgeId })
    })

    // Call log events
    socket.on('callEnded', (callLog) => {
      dispatch({ type: 'ADD_CALL_LOG', payload: callLog })
    })

    // Load initial data
    loadInitialData()

    return () => {
      socket.disconnect()
    }
  }, [])

  const loadInitialData = async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const [
        channelsData,
        bridgesData,
        endpointsData,
        recordingsData,
        applicationsData,
        systemData,
        callLogsData
      ] = await Promise.all([
        asteriskAPI.getChannels(),
        asteriskAPI.getBridges(),
        asteriskAPI.getEndpoints(),
        asteriskAPI.getRecordings(),
        asteriskAPI.getApplications(),
        asteriskAPI.getSystemInfo(),
        asteriskAPI.getCallLogs()
      ])

      dispatch({ type: 'SET_CHANNELS', payload: channelsData })
      dispatch({ type: 'SET_BRIDGES', payload: bridgesData })
      dispatch({ type: 'SET_ENDPOINTS', payload: endpointsData })
      dispatch({ type: 'SET_RECORDINGS', payload: recordingsData })
      dispatch({ type: 'SET_APPLICATIONS', payload: applicationsData })
      dispatch({ type: 'SET_SYSTEM_INFO', payload: systemData })
      dispatch({ type: 'SET_CALL_LOGS', payload: callLogsData })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      toast.error('Failed to load initial data')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const actions = {
    // Channel actions
    hangupChannel: async (channelId) => {
      try {
        await asteriskAPI.hangupChannel(channelId)
        toast.success('Channel hung up successfully')
      } catch (error) {
        toast.error('Failed to hang up channel')
      }
    },

    // Bridge actions
    createBridge: async (bridgeData) => {
      try {
        const bridge = await asteriskAPI.createBridge(bridgeData)
        dispatch({ type: 'ADD_BRIDGE', payload: bridge })
        toast.success('Bridge created successfully')
        return bridge
      } catch (error) {
        toast.error('Failed to create bridge')
        throw error
      }
    },

    destroyBridge: async (bridgeId) => {
      try {
        await asteriskAPI.destroyBridge(bridgeId)
        dispatch({ type: 'REMOVE_BRIDGE', payload: bridgeId })
        toast.success('Bridge destroyed successfully')
      } catch (error) {
        toast.error('Failed to destroy bridge')
      }
    },

    addChannelToBridge: async (channelId, bridgeId) => {
      try {
        await asteriskAPI.addChannelToBridge(channelId, bridgeId)
        toast.success('Channel added to bridge')
      } catch (error) {
        toast.error('Failed to add channel to bridge')
      }
    },

    removeChannelFromBridge: async (channelId, bridgeId) => {
      try {
        await asteriskAPI.removeChannelFromBridge(channelId, bridgeId)
        toast.success('Channel removed from bridge')
      } catch (error) {
        toast.error('Failed to remove channel from bridge')
      }
    },

    // Recording actions
    startRecording: async (channelId, recordingName) => {
      try {
        const recording = await asteriskAPI.startRecording(channelId, recordingName)
        toast.success('Recording started')
        return recording
      } catch (error) {
        toast.error('Failed to start recording')
        throw error
      }
    },

    stopRecording: async (recordingName) => {
      try {
        await asteriskAPI.stopRecording(recordingName)
        toast.success('Recording stopped')
      } catch (error) {
        toast.error('Failed to stop recording')
      }
    },

    // Utility actions
    refreshData: loadInitialData,
    
    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null })
    }
  }

  return (
    <AsteriskContext.Provider value={{ state, actions }}>
      {children}
    </AsteriskContext.Provider>
  )
}

export function useAsterisk() {
  const context = useContext(AsteriskContext)
  if (!context) {
    throw new Error('useAsterisk must be used within an AsteriskProvider')
  }
  return context
}