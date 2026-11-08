// Connects HTTP requests to the goal service. No business rules here.

import * as goalService from './goal.service.js';

export async function list(req, res) {
  const result = await goalService.listGoals(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const goal = await goalService.getGoal(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { goal } });
}

export async function create(req, res) {
  const goal = await goalService.createGoal(req.body, req.user);
  res.status(201).json({ success: true, data: { goal } });
}

export async function update(req, res) {
  const goal = await goalService.updateGoal(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { goal } });
}

export async function cancel(req, res) {
  const goal = await goalService.cancelGoal(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { goal } });
}

export async function reopen(req, res) {
  const goal = await goalService.reopenGoal(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { goal } });
}

export async function reportProgress(req, res) {
  const goal = await goalService.reportProgress(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { goal } });
}