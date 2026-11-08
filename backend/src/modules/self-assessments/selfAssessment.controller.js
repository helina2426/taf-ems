// Connects HTTP requests to the self-assessment service. No business rules here.

import * as service from './selfAssessment.service.js';

export async function listMine(req, res) {
  const result = await service.listMine(req.user);
  res.status(200).json({ success: true, data: result });
}

export async function getMineForPeriod(req, res) {
  const result = await service.getMineForPeriod(req.validated.params.periodId, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function saveMyDraft(req, res) {
  const selfAssessment = await service.saveMyDraft(req.validated.params.periodId, req.body, req.user);
  res.status(200).json({ success: true, data: { selfAssessment } });
}

export async function submitMine(req, res) {
  const selfAssessment = await service.submitMine(req.validated.params.periodId, req.user);
  res.status(200).json({ success: true, data: { selfAssessment } });
}

export async function overview(req, res) {
  const result = await service.getOverview(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const selfAssessment = await service.getById(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { selfAssessment } });
}