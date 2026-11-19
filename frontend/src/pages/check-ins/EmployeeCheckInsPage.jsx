// Manager and Holding: every weekly check-in of ONE employee, newest first (version 2, Module 14).
// Useful before a mid-year or annual evaluation: nothing from the year is forgotten.
// The server checks the company wall: a Manager can only open employees of their own company.

import { Link, useParams } from 'react-router';
import { Alert, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { fullName } from '../../utils/format.js';
import { weekLabel } from '../../utils/checkIns.js';
import { CheckInAnswers, CheckInReply } from './CheckInNote.jsx';

export function EmployeeCheckInsPage() {
  const { employeeId } = useParams();
  const { data, error, loading, reload } = useApi('/check-ins', { employeeId, pageSize: 100 });

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const { employee, items, enabled } = data;
  return (
    <div className="page">
      <Link to="/check-ins" className="back-link">
        ← Weekly check-ins
      </Link>
      <PageHeader title={fullName(employee)} subtitle={`${employee.jobTitle ?? 'Employee'} · ${employee.company.name} · all weekly check-ins`} />
      {!enabled && <Alert type="info">Weekly check-ins are switched off by the Head. Old notes can still be read.</Alert>}
      {items.length === 0 ? (
        <EmptyState>No check-ins yet.</EmptyState>
      ) : (
        items.map((c) => (
          <div className="panel" key={c.id}>
            <h3>{weekLabel(c.weekStart)}</h3>
            <CheckInAnswers checkIn={c} />
            <CheckInReply key={c.updatedAt} checkIn={c} onChange={reload} />
          </div>
        ))
      )}
    </div>
  );
}
