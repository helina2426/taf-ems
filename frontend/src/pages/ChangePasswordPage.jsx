// Change password. Required at first login (mustChangePassword), and available from the menu.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { Alert, ErrorAlert, Field } from '../components/ui.jsx';
import { fieldError } from '../utils/format.js';

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const forced = user.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    // Checked here only to help the user; the backend checks the password rules itself.
    if (newPassword !== confirmPassword) {
      setError({ message: 'The two new passwords are not the same.', details: [{ field: 'confirmPassword', message: 'Type the same new password twice.' }] });
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      if (forced) navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Change password</h1>
        {forced ? (
          <Alert type="info">This is your first login. Please choose your own password to continue.</Alert>
        ) : (
          <p className="muted">After the change, you stay logged in here; other devices must log in again.</p>
        )}
        <Alert type="success">{done && 'Your password has been changed.'}</Alert>
        <ErrorAlert error={error && !error.details ? error : null} />

        <Field label="Current password" error={fieldError(error, 'currentPassword')}>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </Field>
        <Field label="New password" error={fieldError(error, 'newPassword')} hint="At least 8 characters, with a letter and a number.">
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <Field label="Repeat the new password" error={fieldError(error, 'confirmPassword')}>
          <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Change password'}
        </button>
        <div className="auth-links">
          {forced ? (
            <button type="button" className="link-button" onClick={logout}>
              Log out
            </button>
          ) : (
            <Link to="/dashboard">Back to the dashboard</Link>
          )}
        </div>
      </form>
    </main>
  );
}
