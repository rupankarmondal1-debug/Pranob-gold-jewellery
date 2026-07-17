import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap any route that requires a signed-in, enabled user.
 * Pass `adminOnly` to additionally require role === 'admin'.
 * Note: this is a UX convenience, not the real security boundary —
 * that's Row Level Security in Postgres (sql/03_rls_policies.sql).
 * Even if someone bypassed this component, every query would still be
 * blocked/filtered by RLS on the server.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, isDisabled, mustChangePassword, loadingProfile } = useAuth();
  const location = useLocation();

  if (isAuthenticated === undefined) return null; // still checking session
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loadingProfile) return null;
  if (isDisabled) return <Navigate to="/disabled" replace />;
  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
