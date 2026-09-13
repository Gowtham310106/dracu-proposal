import { z } from 'zod';
import { LANGUAGES, MESSAGE_STATUS, MESSAGE_TYPES } from '../enums.js';
import type { Timestamped } from '../api.js';
import { mobile, optionalText } from './common.js';

/**
 * Templates use {{placeholders}}: {{patientName}}, {{clinicName}}, {{branchName}}, {{date}}, {{time}},
 * {{doctorName}}, {{sessionNo}}, {{totalSessions}}, {{balance}}, {{branchPhone}}
 */
export const messageTemplateInput = z.object({
  type: z.enum(MESSAGE_TYPES),
  name: z.string().trim().min(2).max(80),
  language: z.enum(LANGUAGES).default('English'),
  body: z.string().trim().min(5).max(1500),
  active: z.coerce.boolean().default(true),
  /** for SESSION_REMINDER: hours before the slot; for BIRTHDAY: hour of day */
  sendOffsetHours: z.coerce.number().int().min(0).max(72).default(24),
});
export type MessageTemplateInput = z.infer<typeof messageTemplateInput>;
export interface MessageTemplate extends MessageTemplateInput, Timestamped {}

export const manualMessageInput = z.object({
  patientId: z.string().min(1).optional(),
  mobile: mobile.optional(),
  templateId: z.string().min(1).optional(),
  body: optionalText,
}).refine((v) => v.patientId || v.mobile, { message: 'Choose a patient or enter a mobile', path: ['patientId'] })
  .refine((v) => v.templateId || v.body, { message: 'Choose a template or write a message', path: ['body'] });
export type ManualMessageInput = z.infer<typeof manualMessageInput>;

export interface MessageLog extends Timestamped {
  type: (typeof MESSAGE_TYPES)[number];
  to: string;
  patientId?: string;
  patientName?: string;
  branchId?: string;
  templateId?: string;
  body: string;
  status: (typeof MESSAGE_STATUS)[number];
  provider: string;
  providerMessageId?: string;
  error?: string;
  sentAt?: string;
  refType?: string;
  refId?: string;
}

export const MESSAGE_PLACEHOLDERS = [
  'patientName', 'clinicName', 'branchName', 'branchPhone', 'date', 'time', 'doctorName', 'sessionNo', 'totalSessions', 'balance',
] as const;
