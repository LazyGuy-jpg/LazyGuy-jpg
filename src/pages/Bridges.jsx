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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CallMerge as BridgeIcon,
  PersonAdd as AddPersonIcon,
  PersonRemove as RemovePersonIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'

function CreateBridgeDialog({ open, onClose, onCreateBridge }) {
  const [formData, setFormData] = useState({
    type: 'mixing',
    name: '',
    bridgeId: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreateBridge(formData)
    setFormData({ type: 'mixing', name: '', bridgeId: '' })
  }

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Bridge</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Bridge Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={handleChange('type')}
                  label="Bridge Type"
                >
                  <MenuItem value="mixing">Mixing Bridge</MenuItem>
                  <MenuItem value="holding">Holding Bridge</MenuItem>
                  <MenuItem value="dtmf_events">DTMF Events Bridge</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bridge Name"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="Optional friendly name"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bridge ID"
                value={formData.bridgeId}
                onChange={handleChange('bridgeId')}
                placeholder="Optional custom ID"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Create Bridge</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function ChannelManagementDialog({ open, onClose, bridge, channels, onAddChannel, onRemoveChannel }) {
  const [selectedChannel, setSelectedChannel] = useState('')

  const availableChannels = channels.filter(ch => 
    !bridge.channels.includes(ch.id)
  )

  const bridgeChannels = channels.filter(ch => 
    bridge.channels.includes(ch.id)
  )

  const handleAddChannel = () => {
    if (selectedChannel) {
      onAddChannel(selectedChannel, bridge.id)
      setSelectedChannel('')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Bridge Channels - {bridge?.name || bridge?.id}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Add Channel to Bridge
            </Typography>
            <Box display="flex" gap={2} mb={2}>
              <FormControl fullWidth>
                <InputLabel>Available Channels</InputLabel>
                <Select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  label="Available Channels"
                >
                  {availableChannels.map((channel) => (
                    <MenuItem key={channel.id} value={channel.id}>
                      {channel.name || channel.id} ({channel.state})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={handleAddChannel}
                disabled={!selectedChannel}
                startIcon={<AddPersonIcon />}
              >
                Add
              </Button>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Channels in Bridge
            </Typography>
            <List>
              {bridgeChannels.map((channel) => (
                <ListItem key={channel.id}>
                  <ListItemText
                    primary={channel.name || channel.id}
                    secondary={`State: ${channel.state} | Caller: ${channel.caller?.number || 'Unknown'}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => onRemoveChannel(channel.id, bridge.id)}
                      color="error"
                    >
                      <RemovePersonIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {bridgeChannels.length === 0 && (
                <ListItem>
                  <ListItemText primary="No channels in this bridge" />
                </ListItem>
              )}
            </List>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

function Bridges() {
  const { state, actions } = useAsterisk()
  const { bridges, channels } = state
  const [createOpen, setCreateOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [selectedBridge, setSelectedBridge] = useState(null)

  const handleCreateBridge = async (formData) => {
    try {
      await actions.createBridge(formData)
      setCreateOpen(false)
    } catch (error) {
      console.error('Failed to create bridge:', error)
    }
  }

  const handleDestroyBridge = async (bridgeId) => {
    if (window.confirm('Are you sure you want to destroy this bridge?')) {
      await actions.destroyBridge(bridgeId)
    }
  }

  const handleManageChannels = (bridge) => {
    setSelectedBridge(bridge)
    setManageOpen(true)
  }

  const handleAddChannelToBridge = async (channelId, bridgeId) => {
    await actions.addChannelToBridge(channelId, bridgeId)
  }

  const handleRemoveChannelFromBridge = async (channelId, bridgeId) => {
    await actions.removeChannelFromBridge(channelId, bridgeId)
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="600">
          Bridges
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create Bridge
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Bridges
              </Typography>
              <Typography variant="h4">
                {bridges.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Bridges
              </Typography>
              <Typography variant="h4">
                {bridges.filter(b => b.channels && b.channels.length > 0).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Bridged Channels
              </Typography>
              <Typography variant="h4">
                {bridges.reduce((total, bridge) => total + (bridge.channels?.length || 0), 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bridges Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bridge List
          </Typography>
          
          {bridges.length === 0 ? (
            <Box textAlign="center" py={4}>
              <BridgeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No bridges created
              </Typography>
              <Typography color="textSecondary">
                Create a bridge to connect multiple channels
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Bridge ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Technology</TableCell>
                    <TableCell>Channels</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bridges.map((bridge) => (
                    <TableRow key={bridge.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {bridge.name || bridge.id}
                        </Typography>
                        {bridge.name && (
                          <Typography variant="caption" color="textSecondary">
                            {bridge.id}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bridge.bridge_type || 'mixing'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {bridge.technology || 'native_rtp'}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {bridge.channels?.length || 0} channels
                          </Typography>
                          {bridge.channels?.length > 0 && (
                            <Button
                              size="small"
                              onClick={() => handleManageChannels(bridge)}
                            >
                              Manage
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {bridge.creationtime ? 
                          new Date(bridge.creationtime).toLocaleString() : 
                          'Unknown'
                        }
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleManageChannels(bridge)}
                            startIcon={<AddPersonIcon />}
                          >
                            Channels
                          </Button>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDestroyBridge(bridge.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
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

      <CreateBridgeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreateBridge={handleCreateBridge}
      />

      {selectedBridge && (
        <ChannelManagementDialog
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          bridge={selectedBridge}
          channels={channels}
          onAddChannel={handleAddChannelToBridge}
          onRemoveChannel={handleRemoveChannelFromBridge}
        />
      )}
    </Box>
  )
}

export default Bridges