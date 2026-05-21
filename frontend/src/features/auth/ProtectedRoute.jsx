import { Navigate, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { canAccessRole, useAuth } from './AuthContext.jsx';

export default function ProtectedRoute({ children, requiredRole = 'guest' }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }

  if (!canAccessRole(user.role, requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
