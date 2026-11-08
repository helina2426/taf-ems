// Connects HTTP requests to the report service. No business rules here.

import * as service from './report.service.js';

export async function dashboard(req, res) {
  const result = await service.dashboard(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function completion(req, res) {
  const result = await service.completionReport(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function companies(req, res) {
  const result = await service.companyComparison(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function managers(req, res) {
  const result = await service.managerPerformance(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function employee(req, res) {
  const result = await service.employeeReport(req.validated.params.employeeId, req.user);
  res.status(200).json({ success: true, data: result });
}
