// One employee's performance report: their results over time and their goals.
// Opened from the Employees page ("Report"). Who may see it is checked by the backend.

import { Link, useParams } from 'react-router';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner, StatCard } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatDate, fullName, humanize, percent } from '../../utils/format.js';

export function EmployeeReportPage() {
  const { employeeId } = useParams();
  const { data, error, loading } = useApi(`/reports/employees/${employeeId}`);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const { employee, summary, evaluations, goals } = data;
  const change = summary.changeFromPrevious;

  return (
    <div className="page">
      <Link to="/employees" className="back-link">
        ← Back
      </Link>
      <PageHeader title={fullName(employee)} subtitle={`${employee.jobTitle ?? humanize(employee.role)} · ${employee.company.name} · ${employee.employeeNumber}`} />
      <div className="stat-grid">
        <StatCard label="Latest score" value={percent(summary.latestScore)} tone="good" />
        <StatCard
          label="Change from previous"
          value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}`}
          tone={change === null ? 'default' : change >= 0 ? 'good' : 'bad'}
          hint="Percentage points"
        />
        <StatCard label="Average score" value={percent(summary.averageScore)} hint={`${summary.evaluations} evaluations`} />
        <StatCard label="Goals completed" value={goals.byStatus.COMPLETED} hint={`Average progress ${percent(goals.averageProgress)}`} />
      </div>
      <h2 className="section-title">Evaluation history</h2>
      {evaluations.length === 0 ? (
        <EmptyState>No final evaluations yet.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Company</th>
                <th>Status</th>
                <th className="num">Score</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <Link to={`/evaluations/${ev.id}`} className="strong">
                      {ev.period.name}
                    </Link>
                    <div className="muted small">
                      {formatDate(ev.period.startDate)} – {formatDate(ev.period.endDate)}
                    </div>
                  </td>
                  <td>{ev.company.name}</td>
                  <td>
                    <Badge tone="good">{humanize(ev.status)}</Badge>
                  </td>
                  <td className="num strong">{percent(ev.overallScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
