// Connects HTTP requests to the auth service: read the request, call the service,
// send the reply. No business rules here.

import * as authService from './auth.service.js';

// Small details about the request, saved in the audit log.
function getRequestInfo(req) {
  return { ip: req.ip, userAgent: req.get('User-Agent') ?? null };
}

export async function login(req, res) {
  const result = await authService.login(req.body, getRequestInfo(req));
  res.status(200).json({ success: true, data: result });
}

export async function me(req, res) {
  res.status(200).json({ success: true, data: { user: req.user } });
}

export async function changePassword(req, res) {
  const result = await authService.changePassword(req.user, req.body);
  res.status(200).json({ success: true, data: { message: 'Password changed successfully.', ...result } });
}

export async function logout(req, res) {
  await authService.logout(req.user, getRequestInfo(req));
  res.status(200).json({ success: true, data: { message: 'Logged out.' } });
}
