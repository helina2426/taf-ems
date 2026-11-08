// A first page that checks the frontend can talk to the backend.
// It will be replaced by the real pages (login, dashboards) in the next steps.

import { useEffect, useState } from 'react';

export default function App() {
  // "state": values that, when they change, make React draw the page again.
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'error'
  const [message, setMessage] = useState('');

  // "effect": code that runs after the page is shown — here, once, to call the backend.
  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((body) => {
        setStatus('ok');
        setMessage(body.data.message);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Cannot reach the backend. Is it running on port 4000?');
      });
  }, []); // [] = run only once, when the page first appears

  return (
    <main className="center-page">
      <div className="card">
        <h1>Taf EMS</h1>
        <p className="muted">Employee Management and Performance Evaluation</p>
        <p className={`status status-${status}`}>
          {status === 'checking' ? 'Checking the backend…' : message}
        </p>
      </div>
    </main>
  );
}
