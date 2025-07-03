import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Login() {
  const navigate = useNavigate();
  const [apikey, setApikey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!apikey) return setError('API key is required');

    try {
      // Verify API key via a lightweight endpoint
      await api.get('/user', {
        headers: {
          'x-api-key': apikey
        }
      });
      localStorage.setItem('apikey', apikey);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Invalid API key');
    }
  };

  return (
    <div className="container small-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apikey">API Key</label>
          <input
            id="apikey"
            type="text"
            className="form-control"
            value={apikey}
            onChange={e => setApikey(e.target.value)}
            placeholder="Enter your FlowVoIP API key"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn primary-btn">
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;