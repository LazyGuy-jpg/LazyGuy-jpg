import React, { useState } from 'react';
import api from '../services/api';

function Topup() {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!amount) return;

    try {
      const { data } = await api.post('/payments/topup', { amount: parseFloat(amount) });
      setStatus({ type: 'success', message: `Payment initiated. ID: ${data.orderId}` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Unable to initiate payment' });
    }
  };

  return (
    <div className="container small-container">
      <h2>Top up your balance</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          step="0.01"
          min="5"
          placeholder="Amount in USD"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <button type="submit" className="btn primary-btn">Top Up</button>
      </form>
      {status && (
        <p className={status.type === 'error' ? 'error-text' : 'success-text'}>{status.message}</p>
      )}
    </div>
  );
}

export default Topup;