// "Previous / Page 2 of 5 / Next" under a list.
// pagination = { page, pageSize, total, totalPages } (as sent by the backend)

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? <div className="pagination muted">{pagination.total} in total</div> : null;
  }
  const { page, totalPages, total } = pagination;
  return (
    <div className="pagination">
      <button className="btn btn-ghost btn-small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ← Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages} · {total} in total
      </span>
      <button className="btn btn-ghost btn-small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}
