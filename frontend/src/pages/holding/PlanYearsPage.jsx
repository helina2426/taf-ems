// Holding: the list of plan years (version 2), and the window to create a new one.
//
// A plan year (e.g. "2019 EFY" = Hamle 1, 2018 → Sene 30, 2019) is created with its
// 19 periods: 1 year, 2 halves, 4 quarters, 12 months. The calendar comes from Settings.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client.js';
import { FormModal } from '../../components/Modal.jsx';
import { Badge, EmptyState, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { toEthiopian } from '../../utils/ethiopianCalendar.js';
import { fieldError, formatDate } from '../../utils/format.js';
import { CALENDAR_LABEL, PLAN_YEAR_STATUS } from '../../utils/planYears.js';

export function PlanYearsPage() {
  const { data, error, loading, reload } = useApi('/plan-years');
  const [creating, setCreating] = useState(false);
  const items = data?.items ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Plan years"
        subtitle="Each plan year has 2 halves, 4 quarters and 12 months. Plans, monthly results and evaluations belong to a plan year."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New plan year
          </button>
        }
      />
      {loading && !data && <Spinner />}
      <ErrorAlert error={error} />
      {data && items.length === 0 && <EmptyState>No plan years yet. Create the current one to start.</EmptyState>}
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Plan year</th>
                <th>Calendar</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((y) => (
                <tr key={y.id}>
                  <td className="strong">
                    <Link to={`/plan-years/${y.id}`}>{y.name}</Link>
                  </td>
                  <td className="small">{CALENDAR_LABEL[y.calendar]}</td>
                  <td className="small">{formatDate(y.startDate)}</td>
                  <td className="small">{formatDate(y.endDate)}</td>
                  <td>
                    <Badge tone={PLAN_YEAR_STATUS[y.status].tone}>{PLAN_YEAR_STATUS[y.status].label}</Badge>
                  </td>
                  <td className="row-actions">
                    <Link className="btn btn-ghost btn-small" to={`/plan-years/${y.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewPlanYear onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
}

// The plan year we are in today: an Ethiopian fiscal year starts on Hamle 1 (month 11),
// so from Hamle onwards we are already in NEXT year's EFY.
function currentYear(calendar) {
  const today = new Date().toLocaleDateString('en-CA');
  if (calendar === 'GREGORIAN') return Number(today.slice(0, 4));
  const ec = toEthiopian(today);
  return ec.month >= 11 ? ec.year + 1 : ec.year;
}

function NewPlanYear({ onClose, onSaved }) {
  const navigate = useNavigate();
  const settings = useApi('/settings');
  const calendar = settings.data?.settings.cycleCalendar;
  const [year, setYear] = useState('');
  const [preview, setPreview] = useState(null);
  const { run, busy, error } = useSubmit();

  // Suggest the current plan year once we know the calendar.
  useEffect(() => {
    if (calendar && year === '') setYear(String(currentYear(calendar)));
  }, [calendar, year]);

  // Show what the year will look like (nothing is saved).
  useEffect(() => {
    const value = Number(year);
    if (!Number.isInteger(value) || value < 2000 || value > 2100) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    api
      .get('/plan-years/preview', { year: value })
      .then((data) => !cancelled && setPreview(data.planYear))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const months = preview?.periods.filter((p) => p.type === 'MONTH') ?? [];

  return (
    <FormModal title="New plan year" formId="plan-year-form" busy={busy} onClose={onClose} submitLabel="Create">
      <form
        id="plan-year-form"
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post('/plan-years', { year: Number(year) }), (data) => {
            onSaved();
            navigate(`/plan-years/${data.planYear.id}`);
          });
        }}
      >
        <ErrorAlert error={error} inForm />
        {settings.loading && <Spinner label="Loading the settings…" />}
        <ErrorAlert error={settings.error} />
        {calendar && (
          <>
            <p className="muted small">
              Calendar: <strong>{CALENDAR_LABEL[calendar]}</strong> (change it in Settings).{' '}
              {calendar === 'ETHIOPIAN'
                ? 'An Ethiopian fiscal year runs from Hamle 1 to Sene 30 and is named by the year it ends in.'
                : 'A Gregorian plan year runs from 1 January to 31 December.'}
            </p>
            <Field label="Year *" error={fieldError(error, 'year')} hint={calendar === 'ETHIOPIAN' ? 'For example 2019 for "2019 EFY".' : 'For example 2027.'}>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} autoFocus />
            </Field>
          </>
        )}
        {preview && (
          <div className="panel">
            <div className="strong">{preview.name}</div>
            <div className="small muted">
              {formatDate(preview.startDate)} → {formatDate(preview.endDate)}
            </div>
            <ol className="preview-months">
              {months.map((m) => (
                <li key={m.sequence}>{m.name.split(' · ')[1]}</li>
              ))}
            </ol>
            <p className="small muted">The rules (70/30 split, number of KPIs, …) get their default values. You can change them before activating the year.</p>
          </div>
        )}
      </form>
    </FormModal>
  );
}
