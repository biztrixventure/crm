import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuthStore();
  const location = useLocation();

  // Not authenticated
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const redirectMap = {
      super_admin: '/admin',
      readonly_admin: '/admin',
      company_admin: '/company',
      closer: '/closer',
      fronter: '/fronter',
    };
    return <Navigate to={redirectMap[user.role] || '/login'} replace />;
  }

  return children;
}
