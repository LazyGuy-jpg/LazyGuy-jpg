import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneIcon,
  CreditCardIcon,
  ClipboardDocumentIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { userAPI, voiceAPI } from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function UserDashboard() {
  const { user, updateUserData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [apiHealthy, setApiHealthy] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    updateUserData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user's balance from API
      if (user?.apikey) {
        const balanceResponse = await voiceAPI.getBalance(user.apikey);
        setStats(balanceResponse.data.data);
      }

      // Fetch recent calls
      const callsResponse = await userAPI.getCallLogs({ page: 1, limit: 5 });
      setRecentCalls(callsResponse.data.data.logs || []);

      // Fetch announcements
      const announcementsResponse = await userAPI.getAnnouncements();
      setAnnouncements(announcementsResponse.data || []);

      // Check API health
      try {
        const healthResponse = await voiceAPI.health();
        setApiHealthy(healthResponse.data.status === 'healthy');
      } catch (error) {
        setApiHealthy(false);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      toast.success('API key copied to clipboard!');
    }
  };

  const getSuccessRate = () => {
    if (!stats || !stats.totalCalls) return 0;
    return Math.round(((stats.totalCalls - stats.failedCalls) / stats.totalCalls) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.username || user?.email || 'User'}
        </h1>
        <p className="text-gray-600">Here's an overview of your account activity</p>
      </div>

      {/* Account Status Alert */}
      {user?.isNewUser && user?.suspensionDate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Trial Account</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Your account will expire on {format(new Date(user.suspensionDate), 'MMMM d, yyyy')}.
                <Link to="/topup" className="ml-1 font-medium text-yellow-800 underline">
                  Add funds to continue using our services
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Account Balance</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">${user?.balance || '0.00'}</p>
            </div>
            <CreditCardIcon className="h-12 w-12 text-primary-600" />
          </div>
          <Link to="/topup" className="mt-4 block">
            <button className="w-full btn-primary text-sm">
              Add Funds
            </button>
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Calls</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.totalCalls || 0}</p>
            </div>
            <PhoneIcon className="h-12 w-12 text-green-600" />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Success rate: {getSuccessRate()}%
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed Calls</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.failedCalls || 0}</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-red-600" />
          </div>
          <Link to="/call-logs" className="mt-4 text-sm text-primary-600 hover:text-primary-700">
            View all logs →
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">API Status</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {apiHealthy ? 'Operational' : 'Issues Detected'}
              </p>
            </div>
            {apiHealthy ? (
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            ) : (
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
            )}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {apiHealthy ? 'All systems running smoothly' : 'Check status page'}
          </p>
        </div>
      </div>

      {/* API Key Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your API Key</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <code className="text-sm font-mono text-gray-700 break-all">{user?.apiKey}</code>
            <button
              onClick={copyApiKey}
              className="ml-4 p-2 text-gray-500 hover:text-gray-700"
              title="Copy API key"
            >
              <DocumentDuplicateIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Keep your API key secure. Do not share it publicly.
        </p>
      </div>

      {/* Recent Calls */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          <Link to="/call-logs" className="text-sm text-primary-600 hover:text-primary-700">
            View all →
          </Link>
        </div>
        
        {recentCalls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Call ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentCalls.map((call) => (
                  <tr key={call.callId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {call.callId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {call.toNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {call.billableTime}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${call.balanceCut}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No calls yet</p>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h2>
          <div className="space-y-4">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="border-l-4 border-primary-500 pl-4">
                <h3 className="text-sm font-medium text-gray-900">{announcement.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{announcement.content}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {format(new Date(announcement.postedAt), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to="/documentation" className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Documentation</h3>
              <p className="text-sm text-gray-500">Learn how to use our API</p>
            </div>
          </div>
        </Link>

        <Link to="/country-prices" className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <ArrowTrendingUpIcon className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Pricing</h3>
              <p className="text-sm text-gray-500">View country rates</p>
            </div>
          </div>
        </Link>

        <Link to="/settings" className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <ClipboardDocumentIcon className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Account Settings</h3>
              <p className="text-sm text-gray-500">Manage your profile</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}