// Connects HTTP requests to the period service. No business rules here.

import * as periodService from './period.service.js';

export async function list(req, res) {
  const result = await periodService.listPeriods(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const period = await periodService.getPeriod(req.validated.params.id);
  res.status(200).json({ success: true, data: { period } });
}

export async function create(req, res) {
  const period = await periodService.createPeriod(req.body, req.user);
  res.status(201).json({ success: true, data: { period } });
}

export async function update(req, res) {
  const period = await periodService.updatePeriod(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { period } });
}

export async function setStatus(req, res) {
  const period = await periodService.setPeriodStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { period } });
}