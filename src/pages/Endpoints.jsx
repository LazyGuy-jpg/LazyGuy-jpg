import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import {
  Phone as PhoneIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'

function getEndpointStatusColor(state) {
  switch (state?.toLowerCase()) {
    case 'online':
    case 'available':
      return 'success'
    case 'offline':
    case 'unavailable':
      return 'error'
    case 'busy':
    case 'inuse':
      return 'warning'
    default:
      return 'default'
  }
}

function getEndpointStatusIcon(state) {
  switch (state?.toLowerCase()) {
    case 'online':
    case 'available':
      return <OnlineIcon color="success" />
    case 'offline':
    case 'unavailable':
      return <OfflineIcon color="error" />
    case 'busy':
    case 'inuse':
      return <WarningIcon color="warning" />
    default:
      return <InfoIcon color="disabled" />
  }
}

function EndpointDetails({ endpoint }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" gutterBottom>
          Basic Information
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText
              primary="Technology"
              secondary={endpoint.technology || 'Unknown'}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Resource"
              secondary={endpoint.resource || 'Unknown'}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="State"
              secondary={
                <Chip
                  label={endpoint.state || 'Unknown'}
                  color={getEndpointStatusColor(endpoint.state)}
                  size="small"
                />
              }
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Channel IDs"
              secondary={endpoint.channel_ids?.join(', ') || 'None'}
            />
          </ListItem>
        </List>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" gutterBottom>
          Configuration
        </Typography>
        <List dense>
          {endpoint.config && Object.entries(endpoint.config).map(([key, value]) => (
            <ListItem key={key}>
              <ListItemText
                primary={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                secondary={String(value)}
              />
            </ListItem>
          ))}
          {(!endpoint.config || Object.keys(endpoint.config).length === 0) && (
            <ListItem>
              <ListItemText
                primary="No configuration data available"
                secondary="Configuration details may be available in your backend"
              />
            </ListItem>
          )}
        </List>
      </Grid>
    </Grid>
  )
}

function Endpoints() {
  const { state } = useAsterisk()
  const { endpoints } = state

  // Group endpoints by technology
  const groupedEndpoints = endpoints.reduce((groups, endpoint) => {
    const tech = endpoint.technology || 'Unknown'
    if (!groups[tech]) {
      groups[tech] = []
    }
    groups[tech].push(endpoint)
    return groups
  }, {})

  const getStatusCounts = () => {
    return endpoints.reduce((counts, endpoint) => {
      const state = endpoint.state?.toLowerCase() || 'unknown'
      if (state === 'online' || state === 'available') {
        counts.online++
      } else if (state === 'offline' || state === 'unavailable') {
        counts.offline++
      } else if (state === 'busy' || state === 'inuse') {
        counts.busy++
      } else {
        counts.unknown++
      }
      return counts
    }, { online: 0, offline: 0, busy: 0, unknown: 0 })
  }

  const statusCounts = getStatusCounts()

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        Endpoints
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Endpoints
              </Typography>
              <Typography variant="h4">
                {endpoints.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="success.main" gutterBottom>
                Online
              </Typography>
              <Typography variant="h4" color="success.main">
                {statusCounts.online}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="warning.main" gutterBottom>
                Busy
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statusCounts.busy}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="error.main" gutterBottom>
                Offline
              </Typography>
              <Typography variant="h4" color="error.main">
                {statusCounts.offline}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Endpoints by Technology */}
      {Object.keys(groupedEndpoints).length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <PhoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No endpoints found
              </Typography>
              <Typography color="textSecondary">
                Endpoints will appear here when configured in Asterisk
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedEndpoints).map(([technology, techEndpoints]) => (
          <Card key={technology} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {technology.toUpperCase()} Endpoints ({techEndpoints.length})
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Resource</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Active Channels</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {techEndpoints.map((endpoint, index) => (
                      <TableRow key={`${endpoint.technology}-${endpoint.resource}-${index}`} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              {getEndpointStatusIcon(endpoint.state)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {endpoint.resource || `Endpoint ${index + 1}`}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {endpoint.technology}/{endpoint.resource}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={endpoint.state || 'Unknown'}
                            color={getEndpointStatusColor(endpoint.state)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {endpoint.channel_ids?.length || 0} channels
                          </Typography>
                          {endpoint.channel_ids?.length > 0 && (
                            <Typography variant="caption" color="textSecondary">
                              {endpoint.channel_ids.slice(0, 2).join(', ')}
                              {endpoint.channel_ids.length > 2 && '...'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="body2">View Details</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <EndpointDetails endpoint={endpoint} />
                            </AccordionDetails>
                          </Accordion>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  )
}

export default Endpoints