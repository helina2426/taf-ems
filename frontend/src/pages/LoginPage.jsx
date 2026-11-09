// The login page.

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { Alert, ErrorAlert, Field } from '../components/ui.jsx';
import { fieldError } from '../utils/format.js';

export function LoginPage() {
  const { user, login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Go straight to the app.
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      // Go back to the page the user wanted, or to the dashboard.
      const target = loggedIn.mustChangePassword ? '/change-password' : (location.state?.from ?? '/dashboard');
      navigate(target, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <div className="brand brand-large">
          Taf <span>EMS</span>
        </div>
        <p className="muted">Employee Management and Performance Evaluation</p>

        <Alert type="info">{!error && notice}</Alert>
        <ErrorAlert error={error && !error.details ? error : null} />

        <Field label="Email" error={fieldError(error, 'email')}>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Password" error={fieldError(error, 'password')}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
