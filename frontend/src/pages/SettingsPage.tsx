import { useState, useEffect } from 'react';
import { Container, Typography, TextField, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ telegramUsername: '', username: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ telegramUsername: user.telegramUsername || '', username: user.username });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/user/update-settings', form);
      if (res.data.success) {
        setMessage('Updated successfully');
        refreshUser();
      } else {
        setMessage('Failed to update');
      }
    } catch {
      setMessage('Error updating');
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Settings</Typography>
      <form onSubmit={handleSubmit}>
        <TextField name="username" label="Username" fullWidth margin="normal" value={form.username} onChange={handleChange} />
        <TextField name="telegramUsername" label="Telegram Username" fullWidth margin="normal" value={form.telegramUsername} onChange={handleChange} />
        {message && <Typography sx={{ mt: 1 }}>{message}</Typography>}
        <Button type="submit" variant="contained" sx={{ mt: 2 }}>Save</Button>
      </form>
    </Container>
  );
}