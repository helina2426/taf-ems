// Connects HTTP requests to the check-in service. No business rules here.

import * as service from './checkIn.service.js';

export async function status(req, res) {
  res.status(200).json({ success: true, data: { status: await service.getStatus() } });
}

export async function list(req, res) {
  res.status(200).json({ success: true, data: await service.listForEmployee(req.validated.query, req.user) });
}

export async function week(req, res) {
  res.status(200).json({ success: true, data: await service.weekOverview(req.validated.query, req.user) });
}

export async function saveMine(req, res) {
  const checkIn = await service.saveMine(req.validated.params.weekStart, req.body, req.user);
  res.status(200).json({ success: true, data: { checkIn } });
}

export async function deleteMine(req, res) {
  await service.deleteMine(req.validated.params.weekStart, req.user);
  res.status(200).json({ success: true, data: { message: 'Check-in deleted.' } });
}

export async function reply(req, res) {
  const checkIn = await service.reply(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { checkIn } });
}
