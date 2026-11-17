// The business rules for the Holding-wide settings (version 2).
//
//   • cycleCalendar: which calendar NEW plan years follow (ETHIOPIAN by default).
//     Plan years that already exist keep the calendar they were created with.
//   • Every Holding user can read the settings; only the primary Holding user (the Head) can change them.

import prisma from '../../config/prisma.js';
import { AppError } from '../../shared/AppError.js';
import { recordAudit } from '../../shared/auditLog.js';
import * as repository from './settings.repository.js';

export async function getHoldingOrFail(db) {
  const holding = await repository.findHolding(db);
  if (!holding) throw AppError.notFound('The Holding has not been set up yet.');
  return holding;
}

export async function getSettings() {
  return repository.toSettingsResponse(await getHoldingOrFail());
}

export async function updateSettings(data, user) {
  if (!user.isPrimaryHoldingUser) {
    throw AppError.forbidden('Only the primary Holding user can change the settings.');
  }

  const holding = await prisma.$transaction(async (tx) => {
    const before = await getHoldingOrFail(tx);
    const after = await repository.updateHolding(before.id, data, tx);

    const changes = {};
    for (const field of Object.keys(data)) {
      if (before[field] !== after[field]) changes[field] = { from: before[field], to: after[field] };
    }
    if (Object.keys(changes).length > 0) {
      await recordAudit(
        { userId: user.id, action: 'SETTINGS_UPDATED', entityType: 'Holding', entityId: before.id, details: changes },
        tx,
      );
    }
    return after;
  });

  return repository.toSettingsResponse(holding);
}
