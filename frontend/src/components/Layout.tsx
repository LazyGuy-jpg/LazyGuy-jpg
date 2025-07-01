import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Telephony Dashboard</Typography>
          {user && (
            <>
              <Button color="inherit" component={Link} to="/">Dashboard</Button>
              <Button color="inherit" component={Link} to="/call-logs">Call Logs</Button>
              <Button color="inherit" component={Link} to="/settings">Settings</Button>
              <Button color="inherit" onClick={handleLogout}>Logout</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <Outlet />
      </Box>
    </>
  );
}