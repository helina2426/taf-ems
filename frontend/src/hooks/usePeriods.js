// The evaluation periods, for drop-down menus. The most recent come first.
import { useMemo } from 'react';
import { useApi } from './useApi.js';

export function usePeriods() {
  const { data, reload } = useApi('/evaluation-periods');
  // useMemo: build the sorted list only when the data changes (not on every redraw),
  // so pages can safely react to "the periods changed".
  const periods = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt)),
    [data],
  );
  return { periods, reload };
}

// The period to show first: an open one if there is one, otherwise the most recent.
export function defaultPeriodId(periods) {
  return (periods.find((p) => p.status === 'OPEN') ?? periods[0])?.id ?? '';
}
