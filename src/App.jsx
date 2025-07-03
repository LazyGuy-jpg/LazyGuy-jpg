import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import TopupPage from './pages/Topup';
import SettingsPage from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import NotFoundPage from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/topup" element={<TopupPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* Admin nested routes */}
      <Route path="/admin/*" element={<AdminDashboard />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;