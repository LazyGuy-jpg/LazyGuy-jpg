import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import useAuthStore from '../../store/useAuthStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated, isAdmin } = useAuthStore();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    
    const success = await login(apiKey.trim());
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Ilyost</h1>
            <p className="text-gray-600">Professional Voice API Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="apikey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="apikey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Enter your API key"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Logging in...</span>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="text-center">
              <span className="text-sm text-gray-600">Don't have an account? </span>
              <Link to="/register" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Register here
              </Link>
            </div>
            
            <div className="text-center">
              <Link to="/admin/login" className="text-sm text-gray-500 hover:text-gray-700">
                Admin Login
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact support at{' '}
            <a href="mailto:support@ilyost.com" className="text-primary-600 hover:text-primary-700">
              support@ilyost.com
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}