// Connects HTTP requests to the Holding user service. No business rules here.

import * as service from './holdingUser.service.js';

export async function list(req, res) {
  const result = await service.listHoldingUsers(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const holdingUser = await service.getHoldingUser(req.validated.params.id);
  res.status(200).json({ success: true, data: { holdingUser } });
}

export async function create(req, res) {
  const holdingUser = await service.createHoldingUser(req.body, req.user);
  res.status(201).json({ success: true, data: { holdingUser } });
}

export async function setApprovalPermission(req, res) {
  const holdingUser = await service.setApprovalPermission(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { holdingUser } });
}

export async function setStatus(req, res) {
  const holdingUser = await service.setHoldingUserStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { holdingUser } });
}
