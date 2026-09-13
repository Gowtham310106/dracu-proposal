import { Router } from 'express';
import { z } from 'zod';
import { listQuery, patientInput, patientLookupQuery, patientUpdate } from '@acuheal/types';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { TreatmentPackage } from '../../models/TreatmentPackage.js';
import { Appointment } from '../../models/Appointment.js';
import { SessionLog } from '../../models/SessionLog.js';
import { Invoice } from '../../models/Invoice.js';
import { Payment } from '../../models/Payment.js';
import { Media } from '../../models/Media.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { notFound } from '../../middleware/error.js';
import { ok, created, paginate, rx } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { ageFromDob, isoToDate } from '../../utils/dates.js';
import { liftAll, liftRefs } from '../../utils/populate.js';

export const patientsRouter = Router();

const withAge = <T extends Record<string, unknown>>(p: T) => ({ ...p, age: ageFromDob(p.dateOfBirth as Date | null | undefined) });

/** Live duplicate detection while typing the mobile number. Searches ALL branches on purpose. */
patientsRouter.get('/lookup', requirePermission('patients:read'), validate(patientLookupQuery, 'query'), async (req, res) => {
  const { mobile } = query<typeof patientLookupQuery>(req);
  const matches = await Patient.find({ $or: [{ mobile }, { altMobile: mobile }] })
    .select('pid fullName mobile gender dateOfBirth branchId photoUrl chiefComplaint status addressLine area city state pincode email preferredLanguage referralSource createdAt lastVisitAt')
    .populate('branchId', 'code name')
    .limit(5)
    .lean();
  ok(res, liftAll(matches.map(withAge) as Record<string, unknown>[], { branchId: 'branch' }));
});

/** Fast picker search by name / PID / mobile within branch scope. */
patientsRouter.get('/search', requirePermission('patients:read'), async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return ok(res, []);
  const filter = { ...branchFilter(req), status: 'Active', $or: [{ fullName: rx(q) }, { pid: rx(q) }, { mobile: rx(q) }] };
  const items = await Patient.find(filter).select('pid fullName mobile photoUrl gender dateOfBirth contraindicationFlags').limit(10).lean();
  ok(res, items.map(withAge));
});

const patientListQuery = listQuery.extend({ gender: z.string().optional(), referralSource: z.string().optional(), tag: z.string().optional() });
patientsRouter.get('/', requirePermission('patients:read'), validate(patientListQuery, 'query'), async (req, res) => {
  const q = query<typeof patientListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.status) filter.status = q.status;
  if (q.gender) filter.gender = q.gender;
  if (q.referralSource) filter.referralSource = q.referralSource;
  if (q.tag) filter.tags = q.tag;
  if (q.from || q.to) {
    filter.createdAt = { ...(q.from ? { $gte: isoToDate(q.from) } : {}), ...(q.to ? { $lte: new Date(isoToDate(q.to).getTime() + 86399999) } : {}) };
  }
  if (q.q) filter.$or = [{ fullName: rx(q.q) }, { pid: rx(q.q) }, { mobile: rx(q.q) }, { altMobile: rx(q.q) }];
  const { items, meta } = await paginate(Patient, filter, {
    page: q.page,
    limit: q.limit,
    sort: q.sort ?? '-createdAt',
    select: 'pid fullName mobile gender dateOfBirth photoUrl branchId chiefComplaint referralSource status tags contraindicationFlags lastVisitAt createdAt',
    populate: { path: 'branchId', select: 'code name' },
  });
  ok(res, liftAll(items.map(withAge) as Record<string, unknown>[], { branchId: 'branch' }), meta);
});

patientsRouter.get('/:id', requirePermission('patients:read'), async (req, res) => {
  const patient = await Patient.findById(req.params.id).populate('branchId', 'code name').lean();
  if (!patient) throw notFound('Patient not found');
  const activePackage = await TreatmentPackage.findOne({ patientId: patient._id, status: 'Active' })
    .select('packageNo totalSessions sessionsCompleted balance treatmentPlanName customPlanName')
    .sort('-createdAt')
    .lean();
  const [invoiceDue, packageDue, mediaCount] = await Promise.all([
    Invoice.aggregate<{ due: number }>([{ $match: { patientId: patient._id } }, { $group: { _id: null, due: { $sum: '$balance' } } }]),
    TreatmentPackage.aggregate<{ due: number }>([{ $match: { patientId: patient._id, status: { $in: ['Active', 'Paused'] } } }, { $group: { _id: null, due: { $sum: '$balance' } } }]),
    Media.countDocuments({ patientId: patient._id, status: 'Ready' }),
  ]);
  ok(res, {
    ...liftRefs(withAge(patient) as Record<string, unknown>, { branchId: 'branch' }),
    activePackage,
    totals: { invoiceDue: invoiceDue[0]?.due ?? 0, packageDue: packageDue[0]?.due ?? 0, mediaCount },
  });
});

patientsRouter.post('/', requirePermission('patients:write'), validate(patientInput), async (req, res) => {
  const input = body<typeof patientInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const branch = await Branch.findById(branchId).select('code').lean();
  if (!branch) throw notFound('Branch not found');
  const patient = await Patient.create({
    ...input,
    branchId,
    pid: await seq.patientId(branchId, branch.code),
    dateOfBirth: input.dateOfBirth ? isoToDate(input.dateOfBirth) : undefined,
    consentSignedAt: input.consentGiven ? new Date() : undefined,
    createdBy: req.user!.id,
  });
  audit({ userId: req.user!.id, action: 'create', entity: 'Patient', entityId: String(patient._id), branchId, summary: `Patient ${patient.pid} ${patient.fullName} registered` });
  created(res, withAge(patient.toObject()));
});

patientsRouter.patch('/:id', requirePermission('patients:write'), validate(patientUpdate), async (req, res) => {
  const input = body<typeof patientUpdate>(req);
  const before = await Patient.findById(req.params.id).lean();
  if (!before) throw notFound('Patient not found');
  const set: Record<string, unknown> = { ...input, updatedBy: req.user!.id };
  delete set.branchId; // patients do not move branches via PATCH
  if (input.dateOfBirth !== undefined) set.dateOfBirth = input.dateOfBirth ? isoToDate(input.dateOfBirth) : null;
  if (input.consentGiven && !before.consentGiven) set.consentSignedAt = new Date();
  const patient = await Patient.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
  audit({ userId: req.user!.id, action: 'update', entity: 'Patient', entityId: String(before._id), branchId: String(before.branchId), summary: `Patient ${before.pid} updated`, after: input });
  ok(res, withAge(patient!));
});

/** Merged chronological timeline: appointments, sessions, invoices, payments, media. */
patientsRouter.get('/:id/timeline', requirePermission('patients:read'), async (req, res) => {
  const patientId = req.params.id;
  const [appointments, sessions, invoices, payments, media, packages] = await Promise.all([
    Appointment.find({ patientId }).populate('doctorId', 'fullName').sort('-startAt').limit(100).lean(),
    SessionLog.find({ patientId }).populate('doctorId', 'fullName').sort('-createdAt').limit(200).lean(),
    Invoice.find({ patientId }).sort('-dateAt').limit(100).lean(),
    Payment.find({ patientId }).sort('-dateAt').limit(200).lean(),
    Media.find({ patientId, status: 'Ready' }).sort('-createdAt').limit(200).lean(),
    TreatmentPackage.find({ patientId }).sort('-createdAt').lean(),
  ]);
  const events = [
    ...appointments.map((a) => ({ kind: 'appointment', at: a.startAt, id: String(a._id), title: `${a.type} · ${a.slotStart}`, status: a.status, meta: { doctor: (a.doctorId as { fullName?: string })?.fullName, date: a.date } })),
    ...sessions.map((s) => ({ kind: 'session', at: s.createdAt, id: String(s._id), title: `Session ${s.sessionNumber}`, status: s.patientResponse, meta: { doctor: (s.doctorId as { fullName?: string })?.fullName, packageId: String(s.packageId), observations: s.observations, painBefore: s.painScaleBefore, painAfter: s.painScaleAfter } })),
    ...invoices.map((i) => ({ kind: 'invoice', at: i.dateAt, id: String(i._id), title: i.invoiceNo, status: i.paymentStatus, meta: { grandTotal: i.grandTotal, balance: i.balance } })),
    ...payments.map((p) => ({ kind: 'payment', at: p.dateAt, id: String(p._id), title: `${p.receiptNo} · ₹${p.amount}`, status: p.mode, meta: { amount: p.amount, reference: p.reference } })),
    ...media.map((m) => ({ kind: 'media', at: m.createdAt, id: String(m._id), title: m.title || `${m.kind} · ${m.category}`, status: m.kind, meta: { url: m.url, mimeType: m.mimeType } })),
  ].sort((a, b) => new Date(b.at as Date).getTime() - new Date(a.at as Date).getTime());
  ok(res, { events, packages });
});
