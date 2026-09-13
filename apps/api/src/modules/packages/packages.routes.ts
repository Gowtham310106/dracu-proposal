import { Router } from 'express';
import { z } from 'zod';
import { computePackageTotal, listQuery, packageInput, packageUpdate, sessionLogInput } from '@acuheal/types';
import { TreatmentPackage } from '../../models/TreatmentPackage.js';
import { SessionLog } from '../../models/SessionLog.js';
import { Payment } from '../../models/Payment.js';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { Appointment } from '../../models/Appointment.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { ok, created, paginate } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { addDaysIso } from '../../utils/dates.js';
import { liftAll, liftRefs } from '../../utils/populate.js';
import { recomputePackage } from '../billing/billing.service.js';

export const packagesRouter = Router();

const POPULATE = [
  { path: 'patientId', select: 'pid fullName mobile photoUrl' },
  { path: 'assignedDoctorId', select: 'fullName' },
];
const LIFT = { patientId: 'patient', assignedDoctorId: 'doctor' };

const FREQ_DAYS: Record<string, number> = { Daily: 1, 'Alternate days': 2, 'Twice a week': 3.5, Weekly: 7, Custom: 2 };

const pkgListQuery = listQuery.extend({ patientId: z.string().optional(), doctorId: z.string().optional() });
packagesRouter.get('/', requirePermission('packages:read'), validate(pkgListQuery, 'query'), async (req, res) => {
  const q = query<typeof pkgListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.patientId) filter.patientId = q.patientId;
  if (q.doctorId) filter.assignedDoctorId = q.doctorId;
  if (q.status) filter.status = q.status;
  if (q.q) filter.packageNo = new RegExp(q.q, 'i');
  const { items, meta } = await paginate(TreatmentPackage, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-createdAt', populate: POPULATE });
  ok(res, liftAll(items as Record<string, unknown>[], LIFT), meta);
});

packagesRouter.get('/:id', requirePermission('packages:read'), async (req, res) => {
  const pkg = await TreatmentPackage.findById(req.params.id).populate(POPULATE).lean();
  if (!pkg) throw notFound('Package not found');
  const [sessions, payments] = await Promise.all([
    SessionLog.find({ packageId: pkg._id }).populate('doctorId', 'fullName').sort('sessionNumber').lean(),
    Payment.find({ packageId: pkg._id }).sort('-dateAt').lean(),
  ]);
  ok(res, { ...liftRefs(pkg as Record<string, unknown>, LIFT), sessions: liftAll(sessions as Record<string, unknown>[], { doctorId: 'doctor' }), payments });
});

packagesRouter.post('/', requirePermission('packages:write'), validate(packageInput), async (req, res) => {
  const input = body<typeof packageInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const [patient, branch] = await Promise.all([Patient.findById(input.patientId).select('fullName').lean(), Branch.findById(branchId).select('code').lean()]);
  if (!patient) throw notFound('Patient not found');
  if (!branch) throw notFound('Branch not found');
  const totalPayable = computePackageTotal(input);
  const expectedEndDate = input.expectedEndDate ?? addDaysIso(input.startDate, Math.round((input.totalSessions - 1) * (FREQ_DAYS[input.sessionFrequency] ?? 2)));
  const pkg = await TreatmentPackage.create({
    ...input,
    branchId,
    packageNo: await seq.packageNo(branchId, branch.code),
    expectedEndDate,
    totalPayable,
    totalPaid: 0,
    balance: totalPayable,
    createdBy: req.user!.id,
  });
  audit({ userId: req.user!.id, action: 'create', entity: 'TreatmentPackage', entityId: String(pkg._id), branchId, summary: `Package ${pkg.packageNo} (${pkg.totalSessions} sessions, ₹${totalPayable}) for ${patient.fullName}` });
  const full = await TreatmentPackage.findById(pkg._id).populate(POPULATE).lean();
  created(res, liftRefs(full as Record<string, unknown>, LIFT));
});

packagesRouter.patch('/:id', requirePermission('packages:write'), validate(packageUpdate), async (req, res) => {
  const input = body<typeof packageUpdate>(req);
  const pkg = await TreatmentPackage.findById(req.params.id);
  if (!pkg) throw notFound('Package not found');
  if (input.totalSessions !== undefined && input.totalSessions < pkg.sessionsCompleted) throw badRequest(`Already ${pkg.sessionsCompleted} sessions completed`);
  Object.assign(pkg, input, { updatedBy: req.user!.id });
  pkg.totalPayable = computePackageTotal({ pricingMode: pkg.pricingMode, totalSessions: pkg.totalSessions, perSessionFee: pkg.perSessionFee ?? undefined, packageFee: pkg.packageFee ?? undefined, discount: pkg.discount ?? 0 });
  pkg.balance = Math.max(0, pkg.totalPayable - pkg.totalPaid);
  if (input.status === 'Discontinued' && !input.discontinueReason && !pkg.discontinueReason) throw badRequest('Give a reason for discontinuing');
  await pkg.save();
  audit({ userId: req.user!.id, action: 'update', entity: 'TreatmentPackage', entityId: String(pkg._id), branchId: String(pkg.branchId), summary: `Package ${pkg.packageNo} updated`, after: input });
  const full = await TreatmentPackage.findById(pkg._id).populate(POPULATE).lean();
  ok(res, liftRefs(full as Record<string, unknown>, LIFT));
});

packagesRouter.get('/:id/sessions', requirePermission('packages:read'), async (req, res) => {
  const sessions = await SessionLog.find({ packageId: req.params.id }).populate('doctorId', 'fullName').sort('sessionNumber').lean();
  ok(res, liftAll(sessions as Record<string, unknown>[], { doctorId: 'doctor' }));
});

/** Bedside session log: increments the session meter and (optionally) completes the linked appointment. */
packagesRouter.post('/:id/sessions', requirePermission('clinical:write'), validate(sessionLogInput), async (req, res) => {
  const input = body<typeof sessionLogInput>(req);
  const pkg = await TreatmentPackage.findById(req.params.id);
  if (!pkg) throw notFound('Package not found');
  if (pkg.status !== 'Active') throw badRequest(`Package is ${pkg.status.toLowerCase()}; reactivate it to log sessions`);
  if (pkg.sessionsCompleted >= pkg.totalSessions) throw badRequest('All sessions in this package are already completed');
  const sessionNumber = pkg.sessionsCompleted + 1;
  const session = await SessionLog.create({ ...input, packageId: pkg._id, patientId: pkg.patientId, branchId: pkg.branchId, sessionNumber, createdBy: req.user!.id });
  pkg.sessionsCompleted = sessionNumber;
  pkg.lastSessionAt = new Date();
  if (pkg.sessionsCompleted >= pkg.totalSessions) pkg.status = 'Completed';
  await pkg.save();
  await Patient.updateOne({ _id: pkg.patientId }, { $set: { lastVisitAt: new Date() } });
  if (input.appointmentId) {
    await Appointment.updateOne({ _id: input.appointmentId, status: { $nin: ['Cancelled'] } }, { $set: { status: 'Completed', completedAt: new Date(), treatmentPackageId: pkg._id } });
  }
  audit({ userId: req.user!.id, action: 'create', entity: 'SessionLog', entityId: String(session._id), branchId: String(pkg.branchId), summary: `Session ${sessionNumber}/${pkg.totalSessions} logged on ${pkg.packageNo}` });
  created(res, { session: session.toObject(), package: { _id: String(pkg._id), sessionsCompleted: pkg.sessionsCompleted, totalSessions: pkg.totalSessions, status: pkg.status, balance: pkg.balance } });
});

packagesRouter.patch('/:id/sessions/:sid', requirePermission('clinical:write'), validate(sessionLogInput.partial()), async (req, res) => {
  const input = body<z.ZodObject<z.ZodRawShape>>(req);
  const session = await SessionLog.findOneAndUpdate({ _id: req.params.sid, packageId: req.params.id }, { $set: { ...input, updatedBy: req.user!.id } }, { new: true }).lean();
  if (!session) throw notFound('Session not found');
  ok(res, session);
});

/** Recompute totals from payments (used after manual corrections). */
packagesRouter.post('/:id/recompute', requirePermission('billing:write'), async (req, res) => {
  ok(res, await recomputePackage(String(req.params.id)));
});
