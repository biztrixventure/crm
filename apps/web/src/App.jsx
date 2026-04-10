import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useEffect } from 'react';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  const { user, token, checkAuth } = useAuthStore();

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Admin dashboard */}
        <Route path="/admin/*" element={<AdminDashboard />} />

        {/* Profile routes */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={user ? '/admin' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/admin' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
