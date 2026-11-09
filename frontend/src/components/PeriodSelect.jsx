// A drop-down to choose an evaluation period.
export function PeriodSelect({ periods, value, onChange, allowAll = false }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Evaluation period">
      {allowAll && <option value="">All periods</option>}
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.status.toLowerCase()})
        </option>
      ))}
    </select>
  );
}
