// The audit log (SRS FR-10): who did what, and when. Holding only, read only.

import { useState } from 'react';
import { Pagination } from '../../components/Pagination.jsx';
import { EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatDateTime, humanize } from '../../utils/format.js';

const ENTITY_TYPES = ['User', 'Company', 'Employee', 'EvaluationPeriod', 'EvaluationCriterion', 'PerformanceGoal', 'SelfAssessment', 'Evaluation'];

export function AuditLogPage() {
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '', page: 1 });
  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });
  const { data, error, loading } = useApi('/audit-logs', { ...filters, pageSize: 25 });
  const [open, setOpen] = useState(null); // the row whose details are shown

  return (
    <div className="page">
      <PageHeader title="Audit log" subtitle="Every important action, with who did it and when. Entries can never be changed." />
      <div className="toolbar">
        <input className="search" placeholder="Action, e.g. EVALUATION_APPROVED" value={filters.action} onChange={setFilter('action')} />
        <select value={filters.entityType} onChange={setFilter('entityType')} aria-label="Record type">
          <option value="">All record types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="inline-label">
          From <input type="date" value={filters.from} onChange={setFilter('from')} />
        </label>
        <label className="inline-label">
          To <input type="date" value={filters.to} onChange={setFilter('to')} />
        </label>
      </div>

      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && data.items.length === 0 && <EmptyState>No entries match these filters.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Record</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td className="small nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="small">{log.user ? log.user.email : <span className="muted">unknown</span>}</td>
                  <td>
                    <code className="code">{log.action}</code>
                    <div className="muted small">{humanize(log.action)}</div>
                  </td>
                  <td className="small">{log.entityType ?? '—'}</td>
                  <td className="row-actions">
                    {log.details && (
                      <button className="btn btn-ghost btn-small" onClick={() => setOpen(open === log.id ? null : log.id)}>
                        {open === log.id ? 'Hide' : 'Details'}
                      </button>
                    )}
                    {open === log.id && <pre className="details-box">{JSON.stringify(log.details, null, 2)}</pre>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters({ ...filters, page })} />
    </div>
  );
}
