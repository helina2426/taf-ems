// Holding: settings for the whole Holding (version 2).
// Every Holding user can see them; only the primary Holding user (the Head) can change them.

import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, ErrorAlert, Field, PageHeader, Spinner } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { CALENDAR_LABEL } from '../../utils/planYears.js';

export function SettingsPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/settings');
  const { run, busy, error: saveError } = useSubmit();
  const [saved, setSaved] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  const settings = data.settings;
  const canEdit = user.isPrimaryHoldingUser;

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle={settings.holdingName} />
      <div className="panel">
        <h3>Calendar of new plan years</h3>
        <p className="muted small">
          Ethiopian: a plan year runs from Hamle 1 to Sene 30 (for example "2019 EFY"). Gregorian: from 1 January to 31 December.
          Plan years that already exist keep their own calendar.
        </p>
        <p className="muted small">
          This is not how dates are <em>shown</em>: each person chooses that with the "EC / GC dates" switch at the top of the page.
        </p>
        <Alert type="success">{saved && 'Saved.'}</Alert>
        <ErrorAlert error={saveError} />
        <Field label="New plan years follow" hint={canEdit ? undefined : 'Only the primary Holding user can change this.'}>
          <select
            value={settings.cycleCalendar}
            disabled={!canEdit || busy}
            onChange={(e) => {
              setSaved(false);
              run(() => api.patch('/settings', { cycleCalendar: e.target.value }), () => {
                setSaved(true);
                reload();
              });
            }}
          >
            {Object.entries(CALENDAR_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
