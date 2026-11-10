// "My profile" for employees: their work details (read only) and the three fields
// they may change themselves — phone, address and emergency contact (assumption 20).

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, Badge, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { fieldError, formatDate, fullName, humanize } from '../../utils/format.js';

export function ProfilePage() {
  const { data, error, loading, reload } = useApi('/employees/me');
  const [v, setV] = useState({ phone: '', address: '', emergencyContact: '' });
  const [saved, setSaved] = useState(false);
  const { run, busy, error: saveError } = useSubmit();

  useEffect(() => {
    if (data) {
      const e = data.employee;
      setV({ phone: e.phone ?? '', address: e.address ?? '', emergencyContact: e.emergencyContact ?? '' });
    }
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const e = data.employee;
  const set = (key) => (event) => {
    setSaved(false);
    setV({ ...v, [key]: event.target.value });
  };

  return (
    <div className="page">
      <PageHeader title={fullName(e)} subtitle={`${e.jobTitle ?? 'Employee'} · ${e.company.name}`} />
      <div className="detail-grid">
        <div className="panel">
          <h3>Contact details</h3>
          <p className="muted small">You can change these yourself. For other changes, ask your Manager.</p>
          <Alert type="success">{saved && 'Your details have been saved.'}</Alert>
          <form
            className="form-grid"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              run(() => api.patch('/employees/me', v), () => {
                setSaved(true);
                reload();
              });
            }}
          >
            <ErrorAlert error={saveError} inForm />
            <Field label="Phone" error={fieldError(saveError, 'phone')}>
              <input value={v.phone} onChange={set('phone')} />
            </Field>
            <Field label="Address" error={fieldError(saveError, 'address')}>
              <input value={v.address} onChange={set('address')} />
            </Field>
            <Field label="Emergency contact" error={fieldError(saveError, 'emergencyContact')} hint="Name and phone number">
              <input value={v.emergencyContact} onChange={set('emergencyContact')} />
            </Field>
            <div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
        <aside className="panel">
          <h3>Work details</h3>
          <dl className="facts">
            <dt>Email</dt>
            <dd>{e.email}</dd>
            <dt>Employee no.</dt>
            <dd>{e.employeeNumber}</dd>
            <dt>Company</dt>
            <dd>{e.company.name}</dd>
            <dt>Job title</dt>
            <dd>{e.jobTitle ?? '—'}</dd>
            <dt>Department</dt>
            <dd>{e.department ?? '—'}</dd>
            <dt>Hire date</dt>
            <dd>{formatDate(e.hireDate)}</dd>
            <dt>Status</dt>
            <dd>
              <Badge tone="good">{humanize(e.employmentStatus)}</Badge>
            </dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
