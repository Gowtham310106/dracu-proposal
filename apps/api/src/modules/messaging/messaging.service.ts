import { CLINIC_NAME, type MessageType } from '@acuheal/types';
import { MessageLog } from '../../models/MessageLog.js';
import { MessageTemplate } from '../../models/MessageTemplate.js';
import { whatsapp } from '../../integrations/whatsapp/index.js';
import { logger } from '../../config/logger.js';

export type TemplateVars = Partial<Record<'patientName' | 'clinicName' | 'branchName' | 'branchPhone' | 'date' | 'time' | 'doctorName' | 'sessionNo' | 'totalSessions' | 'balance', string | number>>;

export function renderTemplate(bodyText: string, vars: TemplateVars): string {
  const all: Record<string, string | number> = { clinicName: CLINIC_NAME, ...vars } as Record<string, string | number>;
  return bodyText.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => (all[key] !== undefined ? String(all[key]) : ''));
}

export async function activeTemplate(type: MessageType, language?: string) {
  const byLang = language ? await MessageTemplate.findOne({ type, active: true, language }).lean() : null;
  return byLang ?? (await MessageTemplate.findOne({ type, active: true, language: 'English' }).lean()) ?? (await MessageTemplate.findOne({ type, active: true }).lean());
}

export interface SendParams {
  type: MessageType;
  to: string; // 10-digit mobile
  body: string;
  patientId?: string;
  patientName?: string;
  branchId?: string;
  templateId?: string;
  refType?: string;
  refId?: string;
  dedupeKey?: string;
  userId?: string;
}

/** Logs then sends. Returns null when dedupeKey already exists (already sent). */
export async function sendMessage(p: SendParams) {
  if (p.dedupeKey && (await MessageLog.exists({ dedupeKey: p.dedupeKey }))) return null;
  const provider = whatsapp();
  let log;
  try {
    log = await MessageLog.create({ ...p, status: 'Queued', provider: provider.name, createdBy: p.userId });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return null; // raced on dedupeKey
    throw err;
  }
  try {
    const result = await provider.sendText(p.to, p.body);
    log.status = 'Sent';
    log.sentAt = new Date();
    log.providerMessageId = result.providerMessageId;
  } catch (err) {
    log.status = 'Failed';
    log.error = (err as Error).message;
    logger.warn({ err, to: p.to }, 'whatsapp send failed');
  }
  await log.save();
  return log.toObject();
}
