import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import { AsteriskProvider } from './contexts/AsteriskContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Channels from './pages/Channels'
import Bridges from './pages/Bridges'
import Endpoints from './pages/Endpoints'
import Recordings from './pages/Recordings'
import Applications from './pages/Applications'
import SystemInfo from './pages/SystemInfo'
import CallLogs from './pages/CallLogs'

function App() {
  return (
    <AsteriskProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/bridges" element={<Bridges />} />
            <Route path="/endpoints" element={<Endpoints />} />
            <Route path="/recordings" element={<Recordings />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/system" element={<SystemInfo />} />
            <Route path="/call-logs" element={<CallLogs />} />
          </Routes>
        </Layout>
      </Box>
    </AsteriskProvider>
  )
}

export default App