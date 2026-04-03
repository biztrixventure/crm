import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useEffect } from 'react';
import { useSocket } from './hooks/useSocket';

// Pages
import Login from './pages/Login';
import TotpVerify from './pages/TotpVerify';
import AdminDashboard from './pages/AdminDashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import CloserDashboard from './pages/CloserDashboard';
import FronterDashboard from './pages/FronterDashboard';
import Profile from './pages/Profile';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  const { user, token, checkAuth } = useAuthStore();
  
  // Initialize socket connection
  useSocket();

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, []);

  // Redirect based on role
  const getDefaultRoute = () => {
    if (!user) return '/login';
    
    switch (user.role) {
      case 'super_admin':
      case 'readonly_admin':
        return '/admin';
      case 'company_admin':
        return '/company';
      case 'closer':
        return '/closer';
      case 'fronter':
        return '/fronter';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/totp-verify" element={<TotpVerify />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Admin routes */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'readonly_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Company Admin routes */}
        <Route 
          path="/company/*" 
          element={
            <ProtectedRoute allowedRoles={['company_admin']}>
              <CompanyDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Closer routes */}
        <Route 
          path="/closer/*" 
          element={
            <ProtectedRoute allowedRoles={['closer']}>
              <CloserDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Fronter routes */}
        <Route 
          path="/fronter/*" 
          element={
            <ProtectedRoute allowedRoles={['fronter']}>
              <FronterDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Profile routes - accessible by all authenticated users */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'readonly_admin', 'company_admin']}>
              <Profile />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
}

export default App;
