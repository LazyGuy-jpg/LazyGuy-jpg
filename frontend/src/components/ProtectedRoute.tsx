import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactElement } from 'react';

interface Props {
  children: ReactElement;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}><span>Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}