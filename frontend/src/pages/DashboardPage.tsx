import { Typography, Container, Card, CardContent, CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import type { AdminStats } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: _stats } = useQuery<AdminStats>({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data;
    },
    enabled: false,
  });

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      {user ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6">Balance</Typography>
              <Typography variant="h4">${user.balance}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6">Total Calls</Typography>
              <Typography variant="h4">{user.totalCalls}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6">Failed Calls</Typography>
              <Typography variant="h4">{user.failedCalls}</Typography>
            </CardContent>
          </Card>
        </Stack>
      ) : (
        <CircularProgress />
      )}
    </Container>
  );
}