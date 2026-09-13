import { z } from 'zod';
import { FOLLOW_UP_CHANNELS, LEAD_SOURCES, LEAD_STATUS, TREATMENT_PRESETS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { mobile, optionalEnum, optionalIsoDateTime, optionalObjectId, optionalText } from './common.js';

export const leadInput = z.object({
  branchId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  mobile,
  source: z.enum(LEAD_SOURCES),
  campaign: optionalText,
  interestedIn: optionalEnum(TREATMENT_PRESETS),
  complaintSummary: optionalText,
  status: z.enum(LEAD_STATUS).default('New'),
  assignedTo: optionalObjectId,
  nextFollowUpAt: optionalIsoDateTime,
  lostReason: optionalText,
});
export type LeadInput = z.infer<typeof leadInput>;
export const leadUpdate = leadInput.partial();

export const followUpInput = z.object({
  channel: z.enum(FOLLOW_UP_CHANNELS),
  outcome: z.string().trim().min(1).max(300),
  note: optionalText,
  nextFollowUpAt: optionalIsoDateTime,
  status: optionalEnum(LEAD_STATUS),
});
export type FollowUpInput = z.infer<typeof followUpInput>;

export interface FollowUp { _id: string; at: string; by: string; byName?: string; channel: string; outcome: string; note?: string }

export interface Lead extends Omit<LeadInput, 'assignedTo'>, Timestamped {
  leadNo: string;
  assignedTo?: string;
  assignedToName?: string;
  followUps: FollowUp[];
  convertedPatientId?: string;
  convertedAt?: string;
  existingPatientId?: string;
}
