import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Chip,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'

function getCallStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'answered':
    case 'completed':
      return 'success'
    case 'busy':
      return 'warning'
    case 'failed':
    case 'no answer':
    case 'noanswer':
      return 'error'
    default:
      return 'default'
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function CallLogs() {
  const { state, actions } = useAsterisk()
  const { callLogs } = state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')

  const getFilteredLogs = () => {
    let filtered = [...callLogs]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.caller?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.callee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.callId?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter)
    }

    // Apply date filter
    const now = new Date()
    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(log => {
          const logDate = new Date(log.startTime)
          return logDate >= startOfDay(now) && logDate <= endOfDay(now)
        })
        break
      case 'yesterday':
        const yesterday = subDays(now, 1)
        filtered = filtered.filter(log => {
          const logDate = new Date(log.startTime)
          return logDate >= startOfDay(yesterday) && logDate <= endOfDay(yesterday)
        })
        break
      case 'week':
        const weekAgo = subDays(now, 7)
        filtered = filtered.filter(log => {
          const logDate = new Date(log.startTime)
          return logDate >= weekAgo
        })
        break
      default:
        break
    }

    return filtered.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  }

  const filteredLogs = getFilteredLogs()

  const getStatistics = () => {
    const stats = {
      total: filteredLogs.length,
      answered: filteredLogs.filter(log => log.status === 'answered').length,
      failed: filteredLogs.filter(log => log.status === 'failed').length,
      busy: filteredLogs.filter(log => log.status === 'busy').length,
      totalDuration: filteredLogs.reduce((total, log) => total + (log.duration || 0), 0),
      avgDuration: 0
    }
    
    const answeredCalls = filteredLogs.filter(log => log.status === 'answered')
    if (answeredCalls.length > 0) {
      stats.avgDuration = answeredCalls.reduce((total, log) => total + (log.duration || 0), 0) / answeredCalls.length
    }

    return stats
  }

  const stats = getStatistics()

  const handleExport = () => {
    const csvContent = [
      ['Call ID', 'Caller', 'Callee', 'Status', 'Start Time', 'End Time', 'Duration', 'Direction'].join(','),
      ...filteredLogs.map(log => [
        log.callId || '',
        log.caller || '',
        log.callee || '',
        log.status || '',
        log.startTime ? format(new Date(log.startTime), 'yyyy-MM-dd HH:mm:ss') : '',
        log.endTime ? format(new Date(log.endTime), 'yyyy-MM-dd HH:mm:ss') : '',
        log.duration || 0,
        log.direction || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `call-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="600">
          Call Logs
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={actions.refreshData}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Calls
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="success.main" gutterBottom>
                Answered
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.answered}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Duration
              </Typography>
              <Typography variant="h4">
                {formatDuration(stats.totalDuration)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Duration
              </Typography>
              <Typography variant="h4">
                {formatDuration(Math.round(stats.avgDuration))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Search by caller, callee, or call ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="answered">Answered</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="busy">Busy</MenuItem>
                <MenuItem value="no answer">No Answer</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Time Period"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Call Logs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Call History ({filteredLogs.length} calls)
          </Typography>
          
          {filteredLogs.length === 0 ? (
            <Box textAlign="center" py={4}>
              <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No call logs found
              </Typography>
              <Typography color="textSecondary">
                {callLogs.length === 0 
                  ? 'Call logs will appear here as calls are made'
                  : 'Try adjusting your filters to see more results'
                }
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Call ID</TableCell>
                    <TableCell>Caller</TableCell>
                    <TableCell>Callee</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Direction</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.callId || index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {log.callId || `Call ${index + 1}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.caller || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.callee || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status || 'Unknown'}
                          color={getCallStatusColor(log.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {log.startTime ? 
                          format(new Date(log.startTime), 'MMM dd, HH:mm:ss') : 
                          'Unknown'
                        }
                      </TableCell>
                      <TableCell>
                        {formatDuration(log.duration)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.direction || 'Unknown'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default CallLogs