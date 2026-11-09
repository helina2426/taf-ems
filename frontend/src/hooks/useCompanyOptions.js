// The list of companies, for drop-down menus (Holding users only).
import { useApi } from './useApi.js';

export function useCompanyOptions({ onlyActive = true, enabled = true } = {}) {
  const { data } = useApi(enabled ? '/companies' : null, { pageSize: 100, ...(onlyActive && { isActive: 'true' }) });
  return data?.items ?? [];
}
