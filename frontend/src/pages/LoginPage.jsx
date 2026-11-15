// The login page.

import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { Alert, ErrorAlert, Field } from '../components/ui.jsx';
import { PasswordInput } from '../components/PasswordInput.jsx';
import { fieldError } from '../utils/format.js';

export function LoginPage() {
  const { user, login, notice } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Logged in (already, or just now)? Go to the page the user wanted, or to the dashboard.
  // (This also runs right after a successful login, so it must use the same target.)
  if (user) {
    const target = user.mustChangePassword ? '/change-password' : (location.state?.from ?? '/dashboard');
    return <Navigate to={target} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError(null);
    setSubmitting(true);
    try {
      // After this, the "Logged in?" check above sends the user to the right page.
      await login(email, password);
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
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
