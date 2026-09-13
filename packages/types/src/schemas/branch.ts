import { z } from 'zod';
import { INDIAN_STATES, WEEK_DAYS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { hhmm, mobile, optionalEnum, optionalMobile, optionalText } from './common.js';

export const branchInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, '2–4 letters'),
  name: z.string().trim().min(2).max(120),
  phone: mobile,
  whatsappNumber: optionalMobile,
  gstin: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalEnum(INDIAN_STATES),
  active: z.coerce.boolean().default(true),
  workingDays: z.array(z.enum(WEEK_DAYS)).default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  workingHours: z.object({ open: hhmm, close: hhmm }).default({ open: '09:00', close: '20:00' }),
  slotDurationMinutes: z.coerce.number().int().min(10).max(120).default(30),
  reminderHour: z.coerce.number().int().min(0).max(23).default(18),
});
export type BranchInput = z.infer<typeof branchInput>;
export const branchUpdate = branchInput.partial();

export interface Branch extends BranchInput, Timestamped {
  invoiceSeries?: string;
}
