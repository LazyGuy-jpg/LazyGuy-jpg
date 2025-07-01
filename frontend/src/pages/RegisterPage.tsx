import { useState } from 'react';
import { TextField, Button, Container, Typography, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', telegramUsername: '' });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await register(form);
    if (success) navigate('/login');
    else setError('Registration failed');
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" gutterBottom>Register</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <TextField name="email" label="Email" fullWidth margin="normal" value={form.email} onChange={handleChange} />
        <TextField name="telegramUsername" label="Telegram Username" fullWidth margin="normal" value={form.telegramUsername} onChange={handleChange} />
        <TextField name="password" label="Password" type="password" fullWidth margin="normal" value={form.password} onChange={handleChange} />
        <TextField name="confirmPassword" label="Confirm Password" type="password" fullWidth margin="normal" value={form.confirmPassword} onChange={handleChange} />
        {error && <Typography color="error">{error}</Typography>}
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Register</Button>
      </Box>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Already have an account? <Link to="/login">Login</Link>
      </Typography>
    </Container>
  );
}