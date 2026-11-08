// Connects HTTP requests to the employee service. No business rules here.

import * as employeeService from './employee.service.js';

export async function list(req, res) {
  const result = await employeeService.listEmployees(req.validated.query, req.user);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const employee = await employeeService.getEmployee(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { employee } });
}

export async function create(req, res) {
  const employee = await employeeService.createEmployee(req.body, req.user);
  res.status(201).json({ success: true, data: { employee } });
}

export async function update(req, res) {
  const employee = await employeeService.updateEmployee(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { employee } });
}

export async function setStatus(req, res) {
  const employee = await employeeService.setEmploymentStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { employee } });
}

export async function transfer(req, res) {
  const employee = await employeeService.transferEmployee(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { employee } });
}

export async function getMe(req, res) {
  const employee = await employeeService.getMyProfile(req.user);
  res.status(200).json({ success: true, data: { employee } });
}

export async function updateMe(req, res) {
  const employee = await employeeService.updateMyProfile(req.body, req.user);
  res.status(200).json({ success: true, data: { employee } });
}