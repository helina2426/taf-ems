// Database access for the Holding-wide settings. There is only one Holding.

import prisma from '../../config/prisma.js';

export function findHolding(db = prisma) {
  return db.holding.findFirst({ orderBy: { createdAt: 'asc' } });
}

export function updateHolding(id, data, db = prisma) {
  return db.holding.update({ where: { id }, data });
}

export function toSettingsResponse(holding) {
  return {
    holdingName: holding.name,
    // Which calendar NEW plan years follow. Years that already exist keep their own calendar.
    cycleCalendar: holding.cycleCalendar,
    // Module 14: can employees write weekly check-ins? Off = old notes can still be read.
    weeklyCheckInsEnabled: holding.weeklyCheckInsEnabled,
  };
}
