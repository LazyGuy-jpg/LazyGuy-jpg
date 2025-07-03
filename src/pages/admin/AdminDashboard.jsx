import React, { useEffect, useState } from 'react';
import api from '../../services/api';

function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/admin/stats');
        setStats(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div className="container">
      <h2>Admin Dashboard</h2>
      <ul>
        <li>Total Users: {stats.totalUsers}</li>
        <li>Total Calls Today: {stats.totalCallsToday}</li>
        <li>Total Revenue (24h): ${stats.revenue24h}</li>
      </ul>
    </div>
  );
}

export default AdminDashboard;