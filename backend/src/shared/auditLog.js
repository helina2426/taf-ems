// Writes one entry to the AuditLog table: who did what, and when (SRS FR-10).
// Pass "db" when you are inside a transaction, so the audit entry is saved
// (or cancelled) together with the main change.

import prisma from '../config/prisma.js';

export async function recordAudit(
  { userId = null, action, entityType = null, entityId = null, details },
  db = prisma,
) {
  await db.auditLog.create({
    data: { userId, action, entityType, entityId, details },
  });
}