// A "guard" around pages that need a logged-in user.
//
//   <RequireAuth>                       → any logged-in user
//   <RequireAuth roles={['HOLDING']}>   → only these roles
//
// IMPORTANT: this only decides what the browser SHOWS. The real protection is in the backend,
// which checks the token and the role on every request. Never rely on the frontend for security.

import { Navigate, useLocation } from 'react-router';
import { Spinner } from '../components/ui.jsx';
import { useAuth } from './useAuth.js';

export function RequireAuth({ roles, children }) {
  const { user, checking, loggedOut } = useAuth();
  const location = useLocation();

  if (checking) return <Spinner label="Loading your session…" fullPage />;

  // Not logged in → login page, and come back here afterwards
  // (unless the user just logged out on purpose: then the next login starts on the dashboard).
  if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location.pathname }} />;

  // First login → the password must be changed before anything else.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page">
        <h1>Not available</h1>
        <p className="muted">This page is not available for your role.</p>
      </div>
    );
  }

  return children;
}
