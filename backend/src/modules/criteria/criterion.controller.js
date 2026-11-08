// Connects HTTP requests to the criterion service. No business rules here.

import * as criterionService from './criterion.service.js';

export async function list(req, res) {
  const result = await criterionService.listCriteria(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const criterion = await criterionService.getCriterion(req.validated.params.id);
  res.status(200).json({ success: true, data: { criterion } });
}

export async function create(req, res) {
  const criterion = await criterionService.createCriterion(req.body, req.user);
  res.status(201).json({ success: true, data: { criterion } });
}

export async function update(req, res) {
  const criterion = await criterionService.updateCriterion(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { criterion } });
}

export async function setStatus(req, res) {
  const criterion = await criterionService.setCriterionStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { criterion } });
}