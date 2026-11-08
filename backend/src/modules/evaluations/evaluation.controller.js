// Connects HTTP requests to the evaluation service. No business rules here.

import * as service from './evaluation.service.js';
import * as reviewService from './evaluation.review.service.js';

export async function list(req, res) {
  const result = await service.listEvaluations(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const evaluation = await service.getEvaluation(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function create(req, res) {
  const evaluation = await service.createEvaluation(req.body, req.user);
  res.status(201).json({ success: true, data: { evaluation } });
}

export async function saveScores(req, res) {
  const evaluation = await service.saveScores(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function update(req, res) {
  const evaluation = await service.updateEvaluation(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function submit(req, res) {
  const evaluation = await service.submitEvaluation(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

// ---------- Review and publication ----------

export async function approve(req, res) {
  const evaluation = await reviewService.approveEvaluation(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function returnForCorrection(req, res) {
  const evaluation = await reviewService.returnEvaluation(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function publish(req, res) {
  const evaluation = await reviewService.publishEvaluation(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}

export async function acknowledge(req, res) {
  const evaluation = await reviewService.acknowledgeEvaluation(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { evaluation } });
}
