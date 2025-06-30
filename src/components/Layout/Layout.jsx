import { useState } from 'react'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PhoneInTalk as ChannelsIcon,
  CallMerge as BridgesIcon,
  Contacts as EndpointsIcon,
  MicIcon,
  Apps as ApplicationsIcon,
  Info as SystemIcon,
  History as LogsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAsterisk } from '../../contexts/AsteriskContext'

const drawerWidth = 280

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Channels', icon: <ChannelsIcon />, path: '/channels', badge: 'activeChannels' },
  { text: 'Bridges', icon: <BridgesIcon />, path: '/bridges', badge: 'activeBridges' },
  { text: 'Endpoints', icon: <EndpointsIcon />, path: '/endpoints' },
  { text: 'Recordings', icon: <MicIcon />, path: '/recordings' },
  { text: 'Applications', icon: <ApplicationsIcon />, path: '/applications' },
  { text: 'System Info', icon: <SystemIcon />, path: '/system' },
  { text: 'Call Logs', icon: <LogsIcon />, path: '/call-logs' },
]

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { state, actions } = useAsterisk()
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleRefresh = () => {
    actions.refreshData()
  }

  const drawer = (
    <Box>
      <Toolbar sx={{ backgroundColor: theme.palette.primary.main, color: 'white' }}>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          Asterisk ARI
        </Typography>
      </Toolbar>
      <Divider />
      
      {/* Connection Status */}
      <Box sx={{ p: 2 }}>
        <Chip
          label={state.isConnected ? 'Connected' : 'Disconnected'}
          color={state.isConnected ? 'success' : 'error'}
          variant="outlined"
          size="small"
          sx={{ width: '100%' }}
        />
      </Box>
      
      <Divider />
      
      <List>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path
          const badgeCount = item.badge ? state.stats[item.badge] : 0
          
          return (
            <ListItem
              key={item.text}
              button
              selected={isActive}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: isActive ? theme.palette.primary.main : 'inherit' }}>
                {item.badge ? (
                  <Badge badgeContent={badgeCount} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                sx={{ 
                  '& .MuiListItemText-primary': {
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? theme.palette.primary.main : 'inherit'
                  }
                }}
              />
            </ListItem>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Asterisk ARI Dashboard'}
          </Typography>
          
          {/* Connection indicator and refresh button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {state.stats.activeChannels} Active Channels
            </Typography>
            <IconButton color="inherit" onClick={handleRefresh} disabled={state.loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}

export default Layout