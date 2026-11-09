// Loads data from the backend for a page.
//
//   const { data, error, loading, reload } = useApi('/reports/dashboard', { periodId });
//
// It loads again automatically when the path or query changes, and "reload()" loads again on demand.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function useApi(path, query) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // The query object is turned into text so that a new-but-equal object does not reload.
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false; // ignore the answer if the page changed in the meantime
    setLoading(true);
    setError(null);
    api
      .get(path, JSON.parse(queryKey))
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, queryKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, error, loading, reload };
}
