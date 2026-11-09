// Small placeholder pages.

import { Link } from 'react-router';
import { PageHeader } from '../components/ui.jsx';

export function ComingSoonPage({ title }) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle="This page is built in the next step." />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <main className="center-page">
      <div className="card auth-card">
        <h1>Page not found</h1>
        <p className="muted">The address you opened does not exist.</p>
        <Link to="/dashboard">Go to the dashboard</Link>
      </div>
    </main>
  );
}
