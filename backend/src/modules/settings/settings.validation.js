// Rules for the data the settings endpoint accepts.

import { z } from 'zod';

export const CALENDARS = ['ETHIOPIAN', 'GREGORIAN'];

export const updateSettingsSchema = z
  .object({
    cycleCalendar: z.enum(CALENDARS, { error: 'cycleCalendar must be ETHIOPIAN or GREGORIAN.' }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one setting to change.' });
