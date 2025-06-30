import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material'
import {
  Info as InfoIcon,
  Computer as SystemIcon,
  Storage as StorageIcon,
  Network as NetworkIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'

function InfoCard({ title, icon, children }) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

function SystemInfo() {
  const { state } = useAsterisk()
  const { systemInfo } = state

  if (!systemInfo) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight="600">
          System Information
        </Typography>
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                System information not available
              </Typography>
              <Typography color="textSecondary">
                Unable to retrieve system information from Asterisk
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        System Information
      </Typography>

      <Grid container spacing={3}>
        {/* Asterisk Information */}
        <Grid item xs={12} md={6}>
          <InfoCard 
            title="Asterisk Information" 
            icon={<InfoIcon color="primary" />}
          >
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Version"
                  secondary={systemInfo.version || 'Unknown'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Build Options"
                  secondary={systemInfo.build_options || 'Unknown'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Real-time Engine"
                  secondary={systemInfo.realtime_engine || 'Not configured'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="CDR Engine"
                  secondary={systemInfo.cdr_engine || 'Not configured'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="CEL Engine"
                  secondary={systemInfo.cel_engine || 'Not configured'}
                />
              </ListItem>
            </List>
          </InfoCard>
        </Grid>

        {/* System Resources */}
        <Grid item xs={12} md={6}>
          <InfoCard 
            title="System Resources" 
            icon={<SystemIcon color="secondary" />}
          >
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Uptime"
                  secondary={systemInfo.uptime || 'Unknown'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Load Average"
                  secondary={systemInfo.load_average || 'Unknown'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Memory Usage"
                  secondary={systemInfo.memory_usage || 'Unknown'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="CPU Usage"
                  secondary={systemInfo.cpu_usage || 'Unknown'}
                />
              </ListItem>
            </List>
          </InfoCard>
        </Grid>

        {/* Database Information */}
        <Grid item xs={12} md={6}>
          <InfoCard 
            title="Database Information" 
            icon={<StorageIcon color="info" />}
          >
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Database Type"
                  secondary={systemInfo.database_type || 'Not configured'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Database Status"
                  secondary={
                    <Chip
                      label={systemInfo.database_status || 'Unknown'}
                      color={systemInfo.database_status === 'Connected' ? 'success' : 'default'}
                      size="small"
                    />
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Tables"
                  secondary={systemInfo.database_tables || 'Unknown'}
                />
              </ListItem>
            </List>
          </InfoCard>
        </Grid>

        {/* Network Information */}
        <Grid item xs={12} md={6}>
          <InfoCard 
            title="Network Configuration" 
            icon={<NetworkIcon color="warning" />}
          >
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Bind Address"
                  secondary={systemInfo.bind_address || '0.0.0.0'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="HTTP Port"
                  secondary={systemInfo.http_port || '8088'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="HTTPS Port"
                  secondary={systemInfo.https_port || 'Not configured'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="WebSocket Port"
                  secondary={systemInfo.websocket_port || 'Same as HTTP'}
                />
              </ListItem>
            </List>
          </InfoCard>
        </Grid>

        {/* Module Information */}
        <Grid item xs={12}>
          <InfoCard 
            title="Loaded Modules" 
            icon={<InfoIcon color="success" />}
          >
            {systemInfo.modules && systemInfo.modules.length > 0 ? (
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total modules loaded: {systemInfo.modules.length}
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
                  {systemInfo.modules.slice(0, 20).map((module, index) => (
                    <Chip
                      key={index}
                      label={module}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {systemInfo.modules.length > 20 && (
                    <Chip
                      label={`... and ${systemInfo.modules.length - 20} more`}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>
              </Box>
            ) : (
              <Typography color="textSecondary">
                Module information not available
              </Typography>
            )}
          </InfoCard>
        </Grid>
      </Grid>
    </Box>
  )
}

export default SystemInfo