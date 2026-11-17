// Connects HTTP requests to the settings service. No business rules here.

import * as service from './settings.service.js';

export async function get(req, res) {
  const settings = await service.getSettings();
  res.status(200).json({ success: true, data: { settings } });
}

export async function update(req, res) {
  const settings = await service.updateSettings(req.body, req.user);
  res.status(200).json({ success: true, data: { settings } });
}
