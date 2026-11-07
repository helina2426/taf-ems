// Connects HTTP requests to the company service. No business rules here.

import * as companyService from './company.service.js';

export async function list(req, res) {
  const result = await companyService.listCompanies(req.validated.query);
  res.status(200).json({ success: true, data: result });
}

export async function getById(req, res) {
  const company = await companyService.getCompany(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { company } });
}

export async function create(req, res) {
  const company = await companyService.createCompany(req.body, req.user);
  // 201 = "Created": a new record was made.
  res.status(201).json({ success: true, data: { company } });
}

export async function update(req, res) {
  const company = await companyService.updateCompany(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { company } });
}

export async function setStatus(req, res) {
  const company = await companyService.setCompanyStatus(req.validated.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: { company } });
}