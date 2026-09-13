import { Router } from 'express';
import { z } from 'zod';
import { listQuery } from '@acuheal/types';
import { AuditLog } from '../../models/AuditLog.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter } from '../../middleware/branchScope.js';
import { validate, query } from '../../middleware/validate.js';
import { ok, paginate } from '../../utils/http.js';
import { dayBounds, isoToDate } from '../../utils/dates.js';
import { liftAll } from '../../utils/populate.js';

export const auditRouter = Router();

const auditQuery = listQuery.extend({ entity: z.string().optional(), action: z.string().optional(), userId: z.string().optional(), entityId: z.string().optional() });
auditRouter.get('/', requirePermission('audit:read'), validate(auditQuery, 'query'), async (req, res) => {
  const q = query<typeof auditQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.entity) filter.entity = q.entity;
  if (q.action) filter.action = q.action;
  if (q.userId) filter.userId = q.userId;
  if (q.entityId) filter.entityId = q.entityId;
  if (q.q) filter.summary = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: isoToDate(q.from) } : {}), ...(q.to ? { $lte: dayBounds(q.to).end } : {}) };
  const { items, meta } = await paginate(AuditLog, filter, { page: q.page, limit: q.limit, sort: '-createdAt', populate: [{ path: 'userId', select: 'fullName role' }, { path: 'branchId', select: 'code name' }] });
  ok(res, liftAll(items as Record<string, unknown>[], { userId: 'user', branchId: 'branch' }), meta);
});
