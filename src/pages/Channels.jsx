import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tooltip
} from '@mui/material'
import {
  CallEnd as HangupIcon,
  MoreVert as MoreIcon,
  VolumeOff as MuteIcon,
  VolumeUp as UnmuteIcon,
  Pause as HoldIcon,
  PlayArrow as UnholdIcon,
  MicIcon,
  Phone as PhoneIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'
import { format } from 'date-fns'

function ChannelActions({ channel, onAction }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleAction = (action) => {
    onAction(action, channel)
    handleClose()
  }

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => handleAction('hangup')}>
          <HangupIcon sx={{ mr: 1 }} /> Hangup
        </MenuItem>
        <MenuItem onClick={() => handleAction('hold')}>
          <HoldIcon sx={{ mr: 1 }} /> Hold
        </MenuItem>
        <MenuItem onClick={() => handleAction('mute')}>
          <MuteIcon sx={{ mr: 1 }} /> Mute
        </MenuItem>
        <MenuItem onClick={() => handleAction('record')}>
          <MicIcon sx={{ mr: 1 }} /> Start Recording
        </MenuItem>
      </Menu>
    </>
  )
}

function OriginateDialog({ open, onClose, onOriginate }) {
  const [formData, setFormData] = useState({
    endpoint: '',
    extension: '',
    context: 'default',
    priority: '1',
    timeout: '30'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onOriginate(formData)
    setFormData({
      endpoint: '',
      extension: '',
      context: 'default',
      priority: '1',
      timeout: '30'
    })
  }

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Originate Channel</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Endpoint"
                value={formData.endpoint}
                onChange={handleChange('endpoint')}
                placeholder="e.g., PJSIP/1001"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Extension"
                value={formData.extension}
                onChange={handleChange('extension')}
                placeholder="e.g., 1002"
                required
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                fullWidth
                label="Context"
                value={formData.context}
                onChange={handleChange('context')}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Priority"
                value={formData.priority}
                onChange={handleChange('priority')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Timeout (seconds)"
                type="number"
                value={formData.timeout}
                onChange={handleChange('timeout')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Originate</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function getChannelStatusColor(state) {
  switch (state?.toLowerCase()) {
    case 'up':
      return 'success'
    case 'ringing':
      return 'warning'
    case 'down':
      return 'error'
    default:
      return 'default'
  }
}

function formatDuration(creationTime) {
  if (!creationTime) return 'Unknown'
  const now = new Date()
  const created = new Date(creationTime)
  const diffInSeconds = Math.floor((now - created) / 1000)
  
  if (diffInSeconds < 60) return `${diffInSeconds}s`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ${diffInSeconds % 60}s`
  
  const hours = Math.floor(diffInSeconds / 3600)
  const minutes = Math.floor((diffInSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function Channels() {
  const { state, actions } = useAsterisk()
  const { channels, loading } = state
  const [originateOpen, setOriginateOpen] = useState(false)

  const handleChannelAction = async (action, channel) => {
    switch (action) {
      case 'hangup':
        await actions.hangupChannel(channel.id)
        break
      case 'hold':
        // Implementation would depend on your API
        console.log('Hold channel:', channel.id)
        break
      case 'mute':
        // Implementation would depend on your API
        console.log('Mute channel:', channel.id)
        break
      case 'record':
        const recordingName = `recording_${channel.id}_${Date.now()}`
        await actions.startRecording(channel.id, recordingName)
        break
      default:
        break
    }
  }

  const handleOriginate = async (formData) => {
    try {
      // This would interface with your API
      console.log('Originating channel:', formData)
      setOriginateOpen(false)
    } catch (error) {
      console.error('Failed to originate channel:', error)
    }
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="600">
          Channels
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOriginateOpen(true)}
        >
          Originate Channel
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Channels
              </Typography>
              <Typography variant="h4">
                {channels.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Calls
              </Typography>
              <Typography variant="h4">
                {channels.filter(ch => ch.state === 'Up').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Ringing
              </Typography>
              <Typography variant="h4">
                {channels.filter(ch => ch.state === 'Ringing').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Channels Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Channels
          </Typography>
          
          {channels.length === 0 ? (
            <Box textAlign="center" py={4}>
              <PhoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No active channels
              </Typography>
              <Typography color="textSecondary">
                Channels will appear here when calls are active
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Channel ID</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Caller</TableCell>
                    <TableCell>Connected Line</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Bridge</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {channels.map((channel) => (
                    <TableRow key={channel.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {channel.name || channel.id}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {channel.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={channel.state}
                          color={getChannelStatusColor(channel.state)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {channel.caller?.name || channel.caller?.number || 'Unknown'}
                        </Typography>
                        {channel.caller?.number && channel.caller?.name && (
                          <Typography variant="caption" color="textSecondary">
                            {channel.caller.number}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {channel.connected?.name || channel.connected?.number || 'None'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatDuration(channel.creationtime)}
                      </TableCell>
                      <TableCell>
                        {channel.bridges?.length > 0 ? (
                          <Chip
                            label={`Bridge: ${channel.bridges[0]}`}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            None
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={1}>
                          <Tooltip title="Hangup">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleChannelAction('hangup', channel)}
                            >
                              <HangupIcon />
                            </IconButton>
                          </Tooltip>
                          <ChannelActions
                            channel={channel}
                            onAction={handleChannelAction}
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

      <OriginateDialog
        open={originateOpen}
        onClose={() => setOriginateOpen(false)}
        onOriginate={handleOriginate}
      />
    </Box>
  )
}

export default Channels