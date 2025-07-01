import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/useAuthStore';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLogin from './pages/auth/AdminLogin';

// User pages
import UserDashboard from './pages/user/Dashboard';
import CallLogs from './pages/user/CallLogs';
import CountryPrices from './pages/user/CountryPrices';
import TopUp from './pages/user/TopUp';
import Documentation from './pages/user/Documentation';
import Settings from './pages/user/Settings';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import ApiKeys from './pages/admin/ApiKeys';
import Registrations from './pages/admin/Registrations';
import AdminCallLogs from './pages/admin/CallLogs';
import AdminCountryPrices from './pages/admin/CountryPrices';
import BonusRules from './pages/admin/BonusRules';
import AdminDocumentation from './pages/admin/Documentation';
import AdminSettings from './pages/admin/Settings';

// Layouts
import UserLayout from './components/user/Layout';
import AdminLayout from './components/admin/Layout';

// Protected Route Components
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requireAdmin && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* User routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserLayout>
                <UserDashboard />
              </UserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/call-logs"
          element={
            <ProtectedRoute>
              <UserLayout>
                <CallLogs />
              </UserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/country-prices"
          element={
            <ProtectedRoute>
              <UserLayout>
                <CountryPrices />
              </UserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/topup"
          element={
            <ProtectedRoute>
              <UserLayout>
                <TopUp />
              </UserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documentation"
          element={
            <ProtectedRoute>
              <UserLayout>
                <Documentation />
              </UserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <UserLayout>
                <Settings />
              </UserLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/api-keys"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <ApiKeys />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/registrations"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <Registrations />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/call-logs"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <AdminCallLogs />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/country-prices"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <AdminCountryPrices />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bonus-rules"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <BonusRules />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/documentation"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <AdminDocumentation />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout>
                <AdminSettings />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;