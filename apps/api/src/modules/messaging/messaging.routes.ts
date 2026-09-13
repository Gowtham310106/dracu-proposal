import { Router } from 'express';
import { z } from 'zod';
import { listQuery, manualMessageInput, messageTemplateInput, MESSAGE_PLACEHOLDERS } from '@acuheal/types';
import { MessageTemplate } from '../../models/MessageTemplate.js';
import { MessageLog } from '../../models/MessageLog.js';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { ok, created, paginate } from '../../utils/http.js';
import { isoToDate, dayBounds } from '../../utils/dates.js';
import { renderTemplate, sendMessage } from './messaging.service.js';

export const messagingRouter = Router();

messagingRouter.get('/placeholders', requirePermission('messaging:read'), (_req, res) => ok(res, MESSAGE_PLACEHOLDERS));

messagingRouter.get('/templates', requirePermission('messaging:read'), async (_req, res) => {
  ok(res, await MessageTemplate.find().sort('type language').lean());
});

messagingRouter.post('/templates', requirePermission('messaging:manage'), validate(messageTemplateInput), async (req, res) => {
  const tpl = await MessageTemplate.create({ ...body<typeof messageTemplateInput>(req), createdBy: req.user!.id });
  created(res, tpl.toObject());
});

messagingRouter.patch('/templates/:id', requirePermission('messaging:manage'), validate(messageTemplateInput.partial()), async (req, res) => {
  const tpl = await MessageTemplate.findByIdAndUpdate(req.params.id, { $set: { ...body<z.ZodObject<z.ZodRawShape>>(req), updatedBy: req.user!.id } }, { new: true }).lean();
  if (!tpl) throw notFound('Template not found');
  ok(res, tpl);
});

messagingRouter.delete('/templates/:id', requirePermission('messaging:manage'), async (req, res) => {
  const tpl = await MessageTemplate.findByIdAndDelete(req.params.id).lean();
  if (!tpl) throw notFound('Template not found');
  ok(res, { deleted: true });
});

const logQuery = listQuery.extend({ type: z.string().optional(), patientId: z.string().optional() });
messagingRouter.get('/logs', requirePermission('messaging:read'), validate(logQuery, 'query'), async (req, res) => {
  const q = query<typeof logQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.type) filter.type = q.type;
  if (q.status) filter.status = q.status;
  if (q.patientId) filter.patientId = q.patientId;
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: isoToDate(q.from) } : {}), ...(q.to ? { $lte: dayBounds(q.to).end } : {}) };
  const { items, meta } = await paginate(MessageLog, filter, { page: q.page, limit: q.limit, sort: '-createdAt' });
  ok(res, items, meta);
});

/** Manual send from the UI (uses a template or free text). */
messagingRouter.post('/send', requirePermission('messaging:manage'), validate(manualMessageInput), async (req, res) => {
  const input = body<typeof manualMessageInput>(req);
  let to = input.mobile;
  let patientName = '';
  let branchId = req.branchId;
  let patientId: string | undefined;
  if (input.patientId) {
    const patient = await Patient.findById(input.patientId).select('fullName mobile branchId whatsappOptIn').lean();
    if (!patient) throw notFound('Patient not found');
    to = patient.mobile;
    patientName = patient.fullName;
    branchId = String(patient.branchId);
    patientId = String(patient._id);
  }
  if (!to) throw badRequest('No destination number');
  const branch = branchId ? await Branch.findById(branchId).select('name phone').lean() : null;
  let text = input.body ?? '';
  let templateId: string | undefined;
  let type: 'CUSTOM' | 'SESSION_REMINDER' | 'BIRTHDAY' | 'FOLLOW_UP' | 'PAYMENT_DUE' = 'CUSTOM';
  if (input.templateId) {
    const tpl = await MessageTemplate.findById(input.templateId).lean();
    if (!tpl) throw notFound('Template not found');
    text = renderTemplate(tpl.body, { patientName, branchName: branch?.name, branchPhone: branch?.phone });
    templateId = String(tpl._id);
    type = tpl.type as typeof type;
  }
  const log = await sendMessage({ type, to, body: text, patientId, patientName, branchId, templateId, userId: req.user!.id });
  created(res, log);
});
