import React, { useEffect, useState } from 'react';
import api from '../services/api';

function Settings() {
  const [concurrentCalls, setConcurrentCalls] = useState(10);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/user/settings');
        setConcurrentCalls(data.concurrentCalls);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.patch('/user/settings', { concurrentCalls });
      setStatus({ type: 'success', message: 'Settings updated successfully' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to update settings' });
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="container small-container">
      <h2>User Settings</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="ccalls">Concurrent Calls Limit</label>
          <input
            id="ccalls"
            type="number"
            min="1"
            max="1000"
            value={concurrentCalls}
            onChange={e => setConcurrentCalls(parseInt(e.target.value))}
            required
          />
        </div>
        <button type="submit" className="btn primary-btn">Save Settings</button>
      </form>
      {status && (
        <p className={status.type === 'error' ? 'error-text' : 'success-text'}>{status.message}</p>
      )}
    </div>
  );
}

export default Settings;