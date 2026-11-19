// Connects HTTP requests to the plan and KPI services. No business rules here.

import * as kpiService from './kpi.service.js';
import * as planService from './plan.service.js';

const send = (res, plan, status = 200) => res.status(status).json({ success: true, data: { plan } });

// ---------- Plans ----------

export async function list(req, res) {
  res.status(200).json({ success: true, data: await planService.listPlans(req.validated.query, req.user) });
}

export async function getById(req, res) {
  send(res, await planService.getPlan(req.validated.params.id, req.user));
}

export async function create(req, res) {
  send(res, await planService.createPlan(req.body, req.user), 201);
}

export async function submit(req, res) {
  send(res, await planService.submitPlan(req.validated.params.id, req.user));
}

export async function approve(req, res) {
  send(res, await planService.approvePlan(req.validated.params.id, req.user));
}

export async function returnPlan(req, res) {
  send(res, await planService.returnPlan(req.validated.params.id, req.body, req.user));
}

export async function activate(req, res) {
  send(res, await planService.activatePlan(req.validated.params.id, req.user));
}

export async function acknowledge(req, res) {
  send(res, await planService.acknowledgePlan(req.validated.params.id, req.body, req.user));
}

export async function remove(req, res) {
  await planService.deletePlan(req.validated.params.id, req.user);
  res.status(200).json({ success: true, data: { message: 'Plan deleted.' } });
}

// ---------- KPIs (each answer is the whole plan again, so the screen shows the new totals) ----------

export async function createKpi(req, res) {
  send(res, await kpiService.createKpi(req.body, req.user), 201);
}

export async function updateKpi(req, res) {
  send(res, await kpiService.updateKpi(req.validated.params.id, req.body, req.user));
}

export async function deleteKpi(req, res) {
  send(res, await kpiService.deleteKpi(req.validated.params.id, req.user));
}

export async function setMonthTargets(req, res) {
  send(res, await kpiService.setMonthTargets(req.validated.params.id, req.body, req.user));
}
