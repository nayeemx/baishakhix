import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import Loader from './Loader';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, authLoading } = useSelector((state) => state.auth);

  // 1. Always show loader until auth check is complete (no flashes)
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  // 2. Not logged in: redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Logged in but not allowed: redirect to home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // 4. Allowed: render children
  return children;
};

export default ProtectedRoute;
