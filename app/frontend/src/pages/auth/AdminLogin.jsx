import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import useAuthStore from '../../store/useAuthStore';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { adminLogin, loading, isAuthenticated, isAdmin } = useAuthStore();
  const [secret, setSecret] = useState('');

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin');
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!secret.trim()) return;
    
    const success = await adminLogin(secret.trim());
    if (success) {
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4">
              <ShieldCheckIcon className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Access</h1>
            <p className="text-gray-600">Enter your admin credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="secret" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Secret
              </label>
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="input-field"
                placeholder="••••••••••••••••"
                required
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !secret.trim()}
              className="w-full btn-primary bg-gray-900 hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Access Admin Panel</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Back to User Login
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Authorized personnel only. All access attempts are logged.
          </p>
        </div>
      </motion.div>
    </div>
  );
}