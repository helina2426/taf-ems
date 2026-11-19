// Manager and Holding: "Weekly check-ins" of one week (version 2, Module 14).
//
//   • The Manager sees their company's employees: who wrote, who is still waiting for a reply,
//     and can reply to each note.
//   • Holding users see every company (or one, with the filter). They can read, not reply.
//   • "All weeks" opens every note of one employee — useful before writing an evaluation.

import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Badge, EmptyState, ErrorAlert, PageHeader, Spinner, StatCard } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCompanyOptions } from '../../hooks/useCompanyOptions.js';
import { fullName } from '../../utils/format.js';
import { checkInState, shiftWeek, weekLabel, weekName } from '../../utils/checkIns.js';
import { CheckInAnswers, CheckInReply } from './CheckInNote.jsx';

export function TeamCheckInsPage() {
  const { user } = useAuth();
  const isHolding = user.role === 'HOLDING';
  const companies = useCompanyOptions({ enabled: isHolding });
  const [week, setWeek] = useState('');
  const [companyId, setCompanyId] = useState('');
  const { data, error, loading, reload } = useApi('/check-ins/week', { ...(week && { weekStart: week }), ...(companyId && { companyId }) });

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;

  const { weekStart, thisWeek, counts, rows, enabled } = data;
  const missing = counts.employees - counts.written;
  const waiting = counts.written - counts.replied;

  return (
    <div className="page">
      <PageHeader
        title="Weekly check-ins"
        subtitle={isHolding ? 'Short weekly notes of the employees of every company. Read only.' : 'Short weekly notes of your team. Reply to show you read them.'}
        actions={
          isHolding && (
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Company">
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {!enabled && <Alert type="info">Weekly check-ins are switched off by the Head. Old notes can still be read, but nobody can write or reply.</Alert>}

      <div className="week-nav">
        <button className="btn btn-ghost btn-small" onClick={() => setWeek(shiftWeek(weekStart, -1))}>
          ← Previous week
        </button>
        <div className="week-nav-title">
          <div className="strong">{weekName(weekStart, thisWeek)}</div>
          <div className="muted small">{weekLabel(weekStart)}</div>
        </div>
        <button className="btn btn-ghost btn-small" disabled={weekStart >= thisWeek} onClick={() => setWeek(shiftWeek(weekStart, 1))}>
          Next week →
        </button>
      </div>

      <div className="stat-grid">
        <StatCard label="Employees" value={counts.employees} />
        <StatCard label="Wrote a note" value={counts.written} tone={counts.written > 0 ? 'good' : 'default'} />
        <StatCard label="Not written" value={missing} tone={missing > 0 ? 'warn' : 'default'} />
        <StatCard label="Waiting for a reply" value={waiting} tone={waiting > 0 ? 'warn' : 'default'} hint={isHolding ? 'Managers reply' : undefined} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No employees.</EmptyState>
      ) : (
        rows.map(({ employee, checkIn }) => <EmployeeRow key={employee.id} employee={employee} checkIn={checkIn} showCompany={isHolding} onChange={reload} />)
      )}
    </div>
  );
}

function EmployeeRow({ employee, checkIn, showCompany, onChange }) {
  const state = checkInState(checkIn);
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{fullName(employee)}</h3>
          <div className="muted small">
            {employee.jobTitle ?? '—'}
            {showCompany && ` · ${employee.company.name}`}
          </div>
        </div>
        <div className="row-actions">
          <Badge tone={state.tone}>{state.label}</Badge>
          <Link className="btn btn-ghost btn-small" to={`/check-ins/employees/${employee.id}`}>
            All weeks
          </Link>
        </div>
      </div>
      {checkIn ? (
        <>
          <CheckInAnswers checkIn={checkIn} />
          <CheckInReply key={checkIn.updatedAt} checkIn={checkIn} onChange={onChange} />
        </>
      ) : (
        <p className="muted small">No note for this week yet.</p>
      )}
    </div>
  );
}
