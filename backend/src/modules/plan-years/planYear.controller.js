// Connects HTTP requests to the plan-year service. No business rules here.

import * as service from './planYear.service.js';

export async function list(req, res) {
  const result = await service.listPlanYears(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function preview(req, res) {
  const planYear = await service.previewPlanYear(req.validated.query);
  res.status(200).json({ success: true, data: { planYear } });
}

export async function getById(req, res) {
  const planYear = await service.getPlanYear(req.validated.params.id);
  res.status(200).json({ success: true, data: { planYear } });
}

export async function create(req, res) {
  const planYear = await service.createPlanYear(req.body, req.user);
  res.status(201).json({ success: true, data: { planYear } });
}

export async function update(req, res) {
  const planYear = await service.updatePlanYear(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { planYear } });
}

export async function setStatus(req, res) {
  const planYear = await service.setPlanYearStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { planYear } });
}

export async function setMonthStatus(req, res) {
  const { id, periodId } = req.validated.params;
  const planYear = await service.setMonthStatus(id, periodId, req.body, req.user);
  res.status(200).json({ success: true, data: { planYear } });
}

export async function remove(req, res) {
  await service.deletePlanYear(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { message: 'Plan year deleted.' } });
}
