import { Router } from 'express';
import { z } from 'zod';
import { followUpInput, leadInput, leadUpdate, listQuery, patientInput } from '@acuheal/types';
import { Lead } from '../../models/Lead.js';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, conflict, notFound } from '../../middleware/error.js';
import { ok, created, paginate, rx } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { dayBounds, isoToDate, todayIso } from '../../utils/dates.js';
import { liftAll, liftRefs } from '../../utils/populate.js';

export const leadsRouter = Router();

const POPULATE = [
  { path: 'assignedTo', select: 'fullName' },
  { path: 'branchId', select: 'code name' },
  { path: 'convertedPatientId', select: 'pid fullName' },
];
const LIFT = { assignedTo: 'assignee', branchId: 'branch', convertedPatientId: 'convertedPatient' };

const leadListQuery = listQuery.extend({ source: z.string().optional(), assignedTo: z.string().optional(), due: z.enum(['today', 'overdue']).optional() });
leadsRouter.get('/', requirePermission('crm:read'), validate(leadListQuery, 'query'), async (req, res) => {
  const q = query<typeof leadListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.status) filter.status = q.status;
  if (q.source) filter.source = q.source;
  if (q.assignedTo) filter.assignedTo = q.assignedTo;
  if (q.due === 'today') filter.nextFollowUpAt = { $gte: dayBounds(todayIso()).start, $lte: dayBounds(todayIso()).end };
  if (q.due === 'overdue') {
    filter.nextFollowUpAt = { $lt: dayBounds(todayIso()).start };
    filter.status = { $in: ['New', 'Follow-up', 'Attended'] };
  }
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: isoToDate(q.from) } : {}), ...(q.to ? { $lte: dayBounds(q.to).end } : {}) };
  if (q.q) filter.$or = [{ name: rx(q.q) }, { mobile: rx(q.q) }, { leadNo: rx(q.q) }];
  const { items, meta } = await paginate(Lead, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-createdAt', populate: POPULATE });
  ok(res, liftAll(items as Record<string, unknown>[], LIFT), meta);
});

/** Pipeline stats by status and source (for the CRM board header and dashboard). */
leadsRouter.get('/stats', requirePermission('crm:read'), async (req, res) => {
  const match: Record<string, unknown> = { ...branchFilter(req) };
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  if (from || to) match.createdAt = { ...(from ? { $gte: isoToDate(from) } : {}), ...(to ? { $lte: dayBounds(to).end } : {}) };
  const [byStatus, bySource] = await Promise.all([
    Lead.aggregate<{ _id: string; count: number }>([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate<{ _id: string; total: number; converted: number }>([
      { $match: match },
      { $group: { _id: '$source', total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
  ]);
  const total = byStatus.reduce((s, b) => s + b.count, 0);
  const converted = byStatus.find((b) => b._id === 'Converted')?.count ?? 0;
  ok(res, {
    total,
    converted,
    conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
    byStatus: Object.fromEntries(byStatus.map((b) => [b._id, b.count])),
    bySource: bySource.map((s) => ({ source: s._id, total: s.total, converted: s.converted, rate: s.total ? Math.round((s.converted / s.total) * 1000) / 10 : 0 })),
  });
});

leadsRouter.get('/:id', requirePermission('crm:read'), async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate(POPULATE).lean();
  if (!lead) throw notFound('Lead not found');
  const existingPatient = await Patient.findOne({ mobile: lead.mobile }).select('pid fullName').lean();
  ok(res, { ...liftRefs(lead as Record<string, unknown>, LIFT), existingPatientId: existingPatient ? String(existingPatient._id) : undefined, existingPatient });
});

leadsRouter.post('/', requirePermission('crm:write'), validate(leadInput), async (req, res) => {
  const input = body<typeof leadInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const openDup = await Lead.findOne({ mobile: input.mobile, status: { $in: ['New', 'Follow-up', 'Attended'] } }).select('leadNo name status').lean();
  if (openDup && req.query.force !== '1') throw conflict(`An open enquiry already exists for this number (${openDup.leadNo})`, { leadId: String(openDup._id), leadNo: openDup.leadNo, name: openDup.name });
  const existingPatient = await Patient.findOne({ mobile: input.mobile }).select('pid fullName').lean();
  const lead = await Lead.create({
    ...input,
    branchId,
    leadNo: await seq.leadNo(),
    nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    createdBy: req.user!.id,
  });
  const full = await Lead.findById(lead._id).populate(POPULATE).lean();
  created(res, { ...liftRefs(full as Record<string, unknown>, LIFT), existingPatientId: existingPatient ? String(existingPatient._id) : undefined, existingPatient });
});

leadsRouter.patch('/:id', requirePermission('crm:write'), validate(leadUpdate), async (req, res) => {
  const input = body<typeof leadUpdate>(req);
  const set: Record<string, unknown> = { ...input, updatedBy: req.user!.id };
  delete set.branchId;
  if (input.nextFollowUpAt !== undefined) set.nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;
  if (input.status === 'Converted') throw badRequest('Use the convert action to convert a lead');
  const lead = await Lead.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).populate(POPULATE).lean();
  if (!lead) throw notFound('Lead not found');
  ok(res, liftRefs(lead as Record<string, unknown>, LIFT));
});

leadsRouter.post('/:id/follow-ups', requirePermission('crm:write'), validate(followUpInput), async (req, res) => {
  const input = body<typeof followUpInput>(req);
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw notFound('Lead not found');
  if (lead.status === 'Converted') throw badRequest('Lead already converted');
  lead.followUps.push({ at: new Date(), by: req.user!.id as never, byName: req.user!.fullName, channel: input.channel, outcome: input.outcome, note: input.note });
  if (input.nextFollowUpAt) lead.nextFollowUpAt = new Date(input.nextFollowUpAt);
  else if (input.status !== 'Lost') lead.nextFollowUpAt = undefined as never;
  if (input.status && input.status !== 'Converted') lead.status = input.status;
  else if (lead.status === 'New') lead.status = 'Follow-up';
  lead.updatedBy = req.user!.id as never;
  await lead.save();
  const full = await Lead.findById(lead._id).populate(POPULATE).lean();
  ok(res, liftRefs(full as Record<string, unknown>, LIFT));
});

/** Convert: creates a Patient from the submitted registration form and links both ways. */
leadsRouter.post('/:id/convert', requirePermission('crm:write', 'patients:write'), validate(patientInput), async (req, res) => {
  const input = body<typeof patientInput>(req);
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw notFound('Lead not found');
  if (lead.status === 'Converted') throw badRequest('Lead already converted');
  const branchId = resolveWriteBranch(req, input.branchId || String(lead.branchId));
  const branch = await Branch.findById(branchId).select('code').lean();
  if (!branch) throw notFound('Branch not found');
  const patient = await Patient.create({
    ...input,
    branchId,
    leadId: lead._id,
    pid: await seq.patientId(branchId, branch.code),
    dateOfBirth: input.dateOfBirth ? isoToDate(input.dateOfBirth) : undefined,
    consentSignedAt: input.consentGiven ? new Date() : undefined,
    createdBy: req.user!.id,
  });
  lead.status = 'Converted';
  lead.convertedPatientId = patient._id as never;
  lead.convertedAt = new Date();
  lead.updatedBy = req.user!.id as never;
  await lead.save();
  audit({ userId: req.user!.id, action: 'convert', entity: 'Lead', entityId: String(lead._id), branchId, summary: `Lead ${lead.leadNo} converted to patient ${patient.pid}` });
  created(res, { lead: lead.toObject(), patient: patient.toObject() });
});
