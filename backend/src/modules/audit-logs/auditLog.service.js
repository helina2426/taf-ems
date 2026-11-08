// Reading the audit log (SRS FR-10): who did what, and when. Holding users only.
// The log can only be READ here: there is no endpoint to change or delete entries.

import { buildPagination, toSkipTake } from '../../shared/validation.js';
import * as repository from './auditLog.repository.js';

export async function listAuditLogs(query) {
  const { action, userId, entityType, entityId, from, to } = query;

  // "to" includes the whole day: everything before the start of the NEXT day.
  const toEndOfDay = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : undefined;

  const where = {
    ...(action && { action }),
    ...(userId && { userId }),
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: toEndOfDay }) } }),
  };

  const { items, total } = await repository.findMany(where, toSkipTake(query));
  return {
    items: items.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      user: log.user ? { id: log.userId, email: log.user.email, role: log.user.role } : null,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
    })),
    pagination: buildPagination(query, total),
  };
}
