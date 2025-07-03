import React, { useEffect, useState } from 'react';
import api from '../services/api';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get('/user');
        setUser(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Unable to load user data</p>;

  return (
    <div className="container">
      <h2>Dashboard</h2>
      <p>Balance: {user.balance} {user.currency}</p>
      <p>Total Calls: {user.totalCalls}</p>
    </div>
  );
}

export default Dashboard;