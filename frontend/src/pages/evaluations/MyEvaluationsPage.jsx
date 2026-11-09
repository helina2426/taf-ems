// "My evaluations": the person's own PUBLISHED evaluations (Employees and Managers).

import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatDate, percent } from '../../utils/format.js';

export function MyEvaluationsPage() {
  const { user } = useAuth();
  // The backend only returns a person's own evaluations once they are PUBLISHED.
  const { data, error, loading } = useApi('/evaluations', { employeeId: user.employeeId, status: 'PUBLISHED', pageSize: 100 });

  return (
    <div className="page">
      <PageHeader title="My evaluations" subtitle="Your evaluations appear here once they have been approved and published." />
      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No published evaluations yet.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="card-list">
          {data.items.map((ev) => (
            <Link key={ev.id} to={`/evaluations/${ev.id}`} className="card-link">
              <div>
                <div className="strong">{ev.period.name}</div>
                <div className="muted small">
                  {ev.company.name} · published {formatDate(ev.publishedAt)}
                </div>
              </div>
              <div className="card-link-right">
                <span className="score-medium">{percent(ev.overallScore)}</span>
                {ev.acknowledgedAt ? <Badge tone="good">Acknowledged</Badge> : <Badge tone="warn">Please read</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
