import { useState } from 'react';
import { TextField, Button, Container, Typography, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const [apikey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(apikey.trim());
    if (success) navigate('/');
    else setError('Invalid API key');
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" gutterBottom>Login</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="API Key"
          margin="normal"
          value={apikey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        {error && <Typography color="error">{error}</Typography>}
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Login</Button>
      </Box>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Don't have an account? <Link to="/register">Register</Link>
      </Typography>
    </Container>
  );
}