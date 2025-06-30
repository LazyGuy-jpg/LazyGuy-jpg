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
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import {
  Apps as AppsIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon
} from '@mui/icons-material'
import { useAsterisk } from '../contexts/AsteriskContext'

function Applications() {
  const { state } = useAsterisk()
  const { applications } = state

  const getStatusCounts = () => {
    return applications.reduce((counts, app) => {
      if (app.channel_ids && app.channel_ids.length > 0) {
        counts.active++
      } else {
        counts.inactive++
      }
      return counts
    }, { active: 0, inactive: 0 })
  }

  const statusCounts = getStatusCounts()

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        Applications
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Applications
              </Typography>
              <Typography variant="h4">
                {applications.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="success.main" gutterBottom>
                Active
              </Typography>
              <Typography variant="h4" color="success.main">
                {statusCounts.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Inactive
              </Typography>
              <Typography variant="h4">
                {statusCounts.inactive}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Applications Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ARI Applications
          </Typography>
          
          {applications.length === 0 ? (
            <Box textAlign="center" py={4}>
              <AppsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No applications registered
              </Typography>
              <Typography color="textSecondary">
                ARI applications will appear here when registered
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Application Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Active Channels</TableCell>
                    <TableCell>Channel IDs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.name} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {app.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={app.channel_ids?.length > 0 ? 'Active' : 'Inactive'}
                          color={app.channel_ids?.length > 0 ? 'success' : 'default'}
                          size="small"
                          icon={app.channel_ids?.length > 0 ? <ActiveIcon /> : <InactiveIcon />}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {app.channel_ids?.length || 0} channels
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {app.channel_ids?.length > 0 ? (
                          <List dense>
                            {app.channel_ids.slice(0, 3).map((channelId) => (
                              <ListItem key={channelId} sx={{ py: 0, px: 0 }}>
                                <ListItemText
                                  primary={channelId}
                                  primaryTypographyProps={{ variant: 'caption' }}
                                />
                              </ListItem>
                            ))}
                            {app.channel_ids.length > 3 && (
                              <ListItem sx={{ py: 0, px: 0 }}>
                                <ListItemText
                                  primary={`... and ${app.channel_ids.length - 3} more`}
                                  primaryTypographyProps={{ variant: 'caption', color: 'textSecondary' }}
                                />
                              </ListItem>
                            )}
                          </List>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            None
                          </Typography>
                        )}
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

export default Applications