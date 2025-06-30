import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  MicIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'
import { format } from 'date-fns'

function RecordingActions({ recording, onAction }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleAction = (action) => {
    onAction(action, recording)
    handleClose()
  }

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {recording.state === 'recording' && (
          <MenuItem onClick={() => handleAction('stop')}>
            <StopIcon sx={{ mr: 1 }} /> Stop
          </MenuItem>
        )}
        {recording.state === 'recording' && (
          <MenuItem onClick={() => handleAction('pause')}>
            <PauseIcon sx={{ mr: 1 }} /> Pause
          </MenuItem>
        )}
        {recording.state === 'paused' && (
          <MenuItem onClick={() => handleAction('unpause')}>
            <PlayIcon sx={{ mr: 1 }} /> Resume
          </MenuItem>
        )}
        {recording.state === 'done' && (
          <MenuItem onClick={() => handleAction('download')}>
            <DownloadIcon sx={{ mr: 1 }} /> Download
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('delete')}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  )
}

function DeleteConfirmDialog({ open, onClose, onConfirm, recordingName }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Recording</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the recording "{recordingName}"? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function getRecordingStatusColor(state) {
  switch (state?.toLowerCase()) {
    case 'recording':
      return 'error'
    case 'paused':
      return 'warning'
    case 'done':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(seconds) {
  if (!seconds) return '00:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function Recordings() {
  const { state, actions } = useAsterisk()
  const { recordings } = state
  const [deleteDialog, setDeleteDialog] = useState({ open: false, recording: null })

  const handleRecordingAction = async (action, recording) => {
    switch (action) {
      case 'stop':
        await actions.stopRecording(recording.name)
        break
      case 'pause':
        // Implementation would depend on your API
        console.log('Pause recording:', recording.name)
        break
      case 'unpause':
        // Implementation would depend on your API
        console.log('Unpause recording:', recording.name)
        break
      case 'download':
        // Create download link
        const link = document.createElement('a')
        link.href = `/api/recordings/${recording.name}/download`
        link.download = recording.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        break
      case 'delete':
        setDeleteDialog({ open: true, recording })
        break
      default:
        break
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteDialog.recording) {
      // Implementation would depend on your API
      console.log('Delete recording:', deleteDialog.recording.name)
      setDeleteDialog({ open: false, recording: null })
    }
  }

  const getStatusCounts = () => {
    return recordings.reduce((counts, recording) => {
      const state = recording.state?.toLowerCase() || 'unknown'
      counts[state] = (counts[state] || 0) + 1
      return counts
    }, {})
  }

  const statusCounts = getStatusCounts()

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        Recordings
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Recordings
              </Typography>
              <Typography variant="h4">
                {recordings.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="error.main" gutterBottom>
                Active
              </Typography>
              <Typography variant="h4" color="error.main">
                {statusCounts.recording || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="warning.main" gutterBottom>
                Paused
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statusCounts.paused || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="success.main" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {statusCounts.done || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recordings Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recording List
          </Typography>
          
          {recordings.length === 0 ? (
            <Box textAlign="center" py={4}>
              <MicIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No recordings found
              </Typography>
              <Typography color="textSecondary">
                Recordings will appear here when you start recording calls
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Recording Name</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Format</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recordings.map((recording) => (
                    <TableRow key={recording.name} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {recording.name}
                        </Typography>
                        {recording.talking_duration !== undefined && (
                          <Typography variant="caption" color="textSecondary">
                            Talk time: {formatDuration(recording.talking_duration)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={recording.state || 'Unknown'}
                            color={getRecordingStatusColor(recording.state)}
                            size="small"
                          />
                          {recording.state === 'recording' && (
                            <Box className="pulse">
                              <MicIcon color="error" fontSize="small" />
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {recording.duration ? formatDuration(recording.duration) : 
                         recording.state === 'recording' ? 'Recording...' : 'Unknown'}
                        {recording.state === 'recording' && (
                          <LinearProgress 
                            sx={{ mt: 1, width: 80 }} 
                            color="error"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {recording.format || 'wav'}
                      </TableCell>
                      <TableCell>
                        {formatFileSize(recording.size)}
                      </TableCell>
                      <TableCell>
                        {recording.created_time ? 
                          format(new Date(recording.created_time), 'MMM dd, HH:mm') : 
                          'Unknown'}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={1} alignItems="center">
                          {recording.state === 'done' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleRecordingAction('download', recording)}
                              title="Download"
                            >
                              <GetAppIcon />
                            </IconButton>
                          )}
                          <RecordingActions
                            recording={recording}
                            onAction={handleRecordingAction}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, recording: null })}
        onConfirm={handleDeleteConfirm}
        recordingName={deleteDialog.recording?.name}
      />
    </Box>
  )
}

export default Recordings