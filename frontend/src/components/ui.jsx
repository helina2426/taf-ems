// Small building blocks used on many pages.

// A spinning circle with a text, shown while something is loading.
export function Spinner({ label = 'Loading…', fullPage = false }) {
  return (
    <div className={fullPage ? 'spinner-page' : 'spinner-inline'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// A coloured message box. type: 'error' | 'success' | 'info'
export function Alert({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

// Shows an ApiError: its message, plus the field-by-field details.
// In a form (inForm), messages that belong to a field are already shown under that field,
// so only the general ones (with no field) are listed here — nothing appears twice.
export function ErrorAlert({ error, inForm = false }) {
  if (!error) return null;
  const details = (error.details ?? []).filter((d) => !inForm || !d.field);
  return (
    <Alert type="error">
      {error.message}
      {details.length > 0 && (
        <ul className="alert-details">
          {details.map((d, i) => (
            <li key={i}>{d.message}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

// The title at the top of a page, with optional text and buttons on the right.
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

// One number with a label, for dashboards. tone: 'default' | 'good' | 'warn' | 'bad'
export function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      {/* Words (like "Not published yet") are shown smaller than numbers. */}
      <div className={`stat-value ${typeof value === 'string' && value.length > 6 ? 'stat-value-text' : ''}`}>{value ?? '—'}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// A small coloured label, e.g. a status. tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info'
export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Shown when a list has no rows.
export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

// A label + input pair for forms. Shows the field's error under it.
export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
