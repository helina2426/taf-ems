// Connects HTTP requests to the audit log service. No business rules here.

import * as service from './auditLog.service.js';

export async function list(req, res) {
  const result = await service.listAuditLogs(req.validated.query);
  res.status(200).json({ success: true, data: result });
}
