// =====================================================================
// PREI | Route guard
// Redirects unauthenticated users to /login and (optionally) enforces a
// permission. UI-level guard only — the backend still authorizes data.
// =====================================================================
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { can, type Permission } from './permissions';

interface RequireAuthProps {
  children: ReactNode;
  permission?: Permission;
}

export const RequireAuth = ({ children, permission }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Yükleniyor…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !can(user.role, permission)) {
    // Authenticated but not authorized for this area → send home.
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
