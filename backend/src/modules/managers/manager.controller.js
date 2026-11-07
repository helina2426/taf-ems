// Connects HTTP requests to the manager service. No business rules here.

import * as managerService from './manager.service.js';

export async function list(req, res) {
  const result = await managerService.listManagers(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const manager = await managerService.getManager(req.validated.params.id);
  res.status(200).json({ success: true, data: { manager } });
}

export async function create(req, res) {
  const result = await managerService.createManager(req.body, req.user);
  res.status(201).json({ success: true, data: result });
}

export async function update(req, res) {
  const manager = await managerService.updateManager(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { manager } });
}

export async function setStatus(req, res) {
  const manager = await managerService.setManagerStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { manager } });
}

export async function assign(req, res) {
  const result = await managerService.assignManager(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function unassign(req, res) {
  const manager = await managerService.unassignManager(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { manager } });
}