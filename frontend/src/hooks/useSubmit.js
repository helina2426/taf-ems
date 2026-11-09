// Runs a save action (create, update, ...) and keeps track of "busy" and the error.
//
//   const { run, busy, error, setError } = useSubmit();
//   await run(() => api.post('/companies', values), () => { close(); reload(); });

import { useCallback, useState } from 'react';

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (action, onSuccess) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
