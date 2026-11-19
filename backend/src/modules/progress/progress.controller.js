// Connects HTTP requests to the progress service. No business rules here.
// Every answer is the whole progress of the plan again, so the screen shows the new totals and lights.

import * as service from './progress.service.js';

const send = (res, progress) => res.status(200).json({ success: true, data: { progress } });

export async function get(req, res) {
  send(res, await service.getProgress(req.validated.params.id, req.user));
}

export async function enterActual(req, res) {
  const { id, periodId } = req.validated.params;
  send(res, await service.enterActual(id, periodId, req.body, req.user));
}

export async function confirmActual(req, res) {
  const { id, periodId } = req.validated.params;
  send(res, await service.confirmActual(id, periodId, req.user));
}

export async function confirmMonth(req, res) {
  const { id, periodId } = req.validated.params;
  send(res, await service.confirmMonth(id, periodId, req.user));
}

export async function saveComment(req, res) {
  const { id, periodId } = req.validated.params;
  send(res, await service.saveComment(id, periodId, req.body, req.user));
}
