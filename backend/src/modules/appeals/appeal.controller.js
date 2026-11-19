// Connects HTTP requests to the appeal service. No business rules here.

import * as service from './appeal.service.js';

export async function create(req, res) {
  const appeal = await service.createAppeal(req.validated.params.id, req.body, req.user);
  res.status(201).json({ success: true, data: { appeal } });
}

export async function list(req, res) {
  res.status(200).json({ success: true, data: await service.listAppeals(req.validated.query, req.user) });
}

export async function decide(req, res) {
  const appeal = await service.decideAppeal(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { appeal } });
}
