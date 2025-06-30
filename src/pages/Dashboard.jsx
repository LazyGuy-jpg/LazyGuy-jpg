import { Grid, Card, CardContent, Typography, Box, Chip, LinearProgress } from '@mui/material'
import {
  PhoneInTalk as ChannelsIcon,
  CallMerge as BridgesIcon,
  Phone as CallsIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Timer as DurationIcon
} from '@mui/icons-material'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { useAsterisk } from '../contexts/AsteriskContext'
import { format } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

function StatCard({ title, value, icon, color = 'primary', subtitle, loading = false }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" color={color}>
              {loading ? <div className="loading-spinner" /> : value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={`${color}.main`}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function RecentActivity({ callLogs }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Call Activity
        </Typography>
        {callLogs.length === 0 ? (
          <Typography color="textSecondary">No recent activity</Typography>
        ) : (
          <Box>
            {callLogs.slice(0, 5).map((call, index) => (
              <Box
                key={index}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom={index < 4 ? '1px solid #eee' : 'none'}
              >
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {call.caller} → {call.callee}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {call.startTime ? format(new Date(call.startTime), 'HH:mm:ss') : 'Unknown time'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={call.status}
                  color={
                    call.status === 'answered' ? 'success' : 
                    call.status === 'failed' ? 'error' : 'default'
                  }
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function ActiveChannels({ channels }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Active Channels
        </Typography>
        {channels.length === 0 ? (
          <Typography color="textSecondary">No active channels</Typography>
        ) : (
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {channels.map((channel) => (
              <Box
                key={channel.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom="1px solid #eee"
              >
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {channel.name || channel.id}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {channel.state} • {channel.caller?.number || 'Unknown'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={channel.state}
                  color={
                    channel.state === 'Up' ? 'success' :
                    channel.state === 'Ringing' ? 'warning' : 'default'
                  }
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function CallChart({ stats }) {
  const data = {
    labels: ['Successful', 'Failed'],
    datasets: [
      {
        label: 'Calls',
        data: [stats.successfulCalls, stats.failedCalls],
        backgroundColor: ['#4caf50', '#f44336'],
        borderWidth: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Call Statistics
        </Typography>
        <Box sx={{ height: 250 }}>
          <Doughnut data={data} options={options} />
        </Box>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const { state } = useAsterisk()
  const { stats, channels, bridges, callLogs, loading, isConnected } = state

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isConnected) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography variant="h5" gutterBottom>
          Not Connected to Asterisk ARI
        </Typography>
        <Typography color="textSecondary">
          Please check your connection and try again.
        </Typography>
        <LinearProgress sx={{ width: '300px', mt: 2 }} />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Channels"
            value={stats.activeChannels}
            icon={<ChannelsIcon fontSize="large" />}
            color="primary"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Bridges"
            value={stats.activeBridges}
            icon={<BridgesIcon fontSize="large" />}
            color="secondary"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Calls"
            value={stats.totalCalls}
            icon={<CallsIcon fontSize="large" />}
            color="info"
            subtitle="Today"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Duration"
            value={formatDuration(stats.avgCallDuration)}
            icon={<DurationIcon fontSize="large" />}
            color="warning"
            loading={loading}
          />
        </Grid>
        
        {/* Success/Failure Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Successful Calls"
            value={stats.successfulCalls}
            icon={<SuccessIcon fontSize="large" />}
            color="success"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed Calls"
            value={stats.failedCalls}
            icon={<ErrorIcon fontSize="large" />}
            color="error"
            loading={loading}
          />
        </Grid>
        
        {/* Charts and Lists */}
        <Grid item xs={12} md={6}>
          <CallChart stats={stats} />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <RecentActivity callLogs={callLogs} />
        </Grid>
        
        <Grid item xs={12}>
          <ActiveChannels channels={channels} />
        </Grid>
      </Grid>
    </Box>
  )
}

export default Dashboard