import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export type AuditAction = 'create' | 'update' | 'delete' | 'status' | 'payment' | 'login' | 'convert' | 'print';

/** Fire-and-forget audit entry for sensitive mutations (patients, billing, payments, staff). */
export function audit(params: {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  branchId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}): void {
  AuditLog.create({
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    branchId: params.branchId,
    summary: params.summary,
    before: params.before,
    after: params.after,
    ip: params.ip,
  }).catch((err) => logger.warn({ err }, 'audit write failed'));
}
