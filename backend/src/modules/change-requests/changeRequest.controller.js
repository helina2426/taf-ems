// Connects HTTP requests to the target-change service. No business rules here.

import * as service from './changeRequest.service.js';

export async function create(req, res) {
  const request = await service.createRequest(req.validated.params.id, req.body, req.user);
  res.status(201).json({ success: true, data: { request } });
}

export async function list(req, res) {
  res.status(200).json({ success: true, data: await service.listRequests(req.validated.query, req.user) });
}

export async function approve(req, res) {
  const request = await service.approveRequest(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { request } });
}

export async function reject(req, res) {
  const request = await service.rejectRequest(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { request } });
}
