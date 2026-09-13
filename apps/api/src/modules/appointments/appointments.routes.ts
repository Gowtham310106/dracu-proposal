import { Router } from 'express';
import { z } from 'zod';
import { appointmentInput, appointmentReschedule, appointmentStatusInput, appointmentUpdate, dayQuery, listQuery, type Slot } from '@acuheal/types';
import { Appointment } from '../../models/Appointment.js';
import { Branch } from '../../models/Branch.js';
import { Patient } from '../../models/Patient.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, conflict, notFound } from '../../middleware/error.js';
import { ok, created, paginate } from '../../utils/http.js';
import { combine, todayIso } from '../../utils/dates.js';
import { liftAll, liftRefs } from '../../utils/populate.js';

export const appointmentsRouter = Router();

const POPULATE = [
  { path: 'patientId', select: 'pid fullName mobile photoUrl contraindicationFlags' },
  { path: 'doctorId', select: 'fullName' },
  { path: 'treatmentPackageId', select: 'packageNo totalSessions sessionsCompleted balance treatmentPlanName customPlanName' },
];
const LIFT = { patientId: 'patient', doctorId: 'doctor', treatmentPackageId: 'package' };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function toHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

async function assertNoDoctorClash(params: { doctorId: string; date: string; slotStart: string; slotEnd: string; excludeId?: string }) {
  const clash = await Appointment.findOne({
    doctorId: params.doctorId,
    date: params.date,
    status: { $nin: ['Cancelled', 'No-show'] },
    slotStart: { $lt: params.slotEnd },
    slotEnd: { $gt: params.slotStart },
    ...(params.excludeId ? { _id: { $ne: params.excludeId } } : {}),
  })
    .select('slotStart slotEnd')
    .lean();
  if (clash) throw conflict(`Doctor already has an appointment ${clash.slotStart}–${clash.slotEnd}`, { slotStart: clash.slotStart, slotEnd: clash.slotEnd });
}

/** Day directory: appointments for a date + slot grid built from branch config. */
appointmentsRouter.get('/day', requirePermission('appointments:read'), validate(dayQuery, 'query'), async (req, res) => {
  const q = query<typeof dayQuery>(req);
  const branchId = q.branchId && req.user!.role === 'ADMIN' ? q.branchId : req.branchId ?? q.branchId ?? req.user!.defaultBranchId;
  const branch = await Branch.findById(branchId).lean();
  if (!branch) throw notFound('Branch not found');
  const filter: Record<string, unknown> = { branchId, date: q.date };
  if (q.doctorId) filter.doctorId = q.doctorId;
  const items = await Appointment.find(filter).populate(POPULATE).sort('slotStart').lean();
  const step = branch.slotDurationMinutes ?? 30;
  const open = toMinutes(branch.workingHours?.open ?? '09:00');
  const close = toMinutes(branch.workingHours?.close ?? '20:00');
  const slots: Slot[] = [];
  for (let t = open; t + step <= close; t += step) {
    const start = toHhmm(t);
    const end = toHhmm(t + step);
    const inSlot = items.filter((a) => a.slotStart < end && a.slotEnd > start && a.status !== 'Cancelled');
    slots.push({ start, end, booked: inSlot.length, appointments: inSlot.map((a) => String(a._id)) });
  }
  const counts = items.reduce<Record<string, number>>((acc, a) => ((acc[a.status] = (acc[a.status] ?? 0) + 1), acc), {});
  ok(res, { date: q.date, branch: { _id: String(branch._id), code: branch.code, name: branch.name, slotDurationMinutes: step, workingHours: branch.workingHours }, slots, appointments: liftAll(items as Record<string, unknown>[], LIFT), counts });
});

const apptListQuery = listQuery.extend({ patientId: z.string().optional(), doctorId: z.string().optional(), type: z.string().optional() });
appointmentsRouter.get('/', requirePermission('appointments:read'), validate(apptListQuery, 'query'), async (req, res) => {
  const q = query<typeof apptListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.patientId) filter.patientId = q.patientId;
  if (q.doctorId) filter.doctorId = q.doctorId;
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const { items, meta } = await paginate(Appointment, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-date -slotStart', populate: POPULATE });
  ok(res, liftAll(items as Record<string, unknown>[], LIFT), meta);
});

appointmentsRouter.get('/:id', requirePermission('appointments:read'), async (req, res) => {
  const appt = await Appointment.findById(req.params.id).populate(POPULATE).lean();
  if (!appt) throw notFound('Appointment not found');
  ok(res, liftRefs(appt as Record<string, unknown>, LIFT));
});

appointmentsRouter.post('/', requirePermission('appointments:write'), validate(appointmentInput), async (req, res) => {
  const input = body<typeof appointmentInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const patient = await Patient.findById(input.patientId).select('fullName status').lean();
  if (!patient) throw notFound('Patient not found');
  if (patient.status !== 'Active') throw badRequest('Patient is inactive');
  await assertNoDoctorClash(input);
  const appt = await Appointment.create({ ...input, branchId, startAt: combine(input.date, input.slotStart), createdBy: req.user!.id });
  const full = await Appointment.findById(appt._id).populate(POPULATE).lean();
  created(res, liftRefs(full as Record<string, unknown>, LIFT));
});

appointmentsRouter.patch('/:id', requirePermission('appointments:write'), validate(appointmentUpdate), async (req, res) => {
  const input = body<typeof appointmentUpdate>(req);
  const existing = await Appointment.findById(req.params.id).lean();
  if (!existing) throw notFound('Appointment not found');
  if (input.doctorId && input.doctorId !== String(existing.doctorId)) {
    await assertNoDoctorClash({ doctorId: input.doctorId, date: existing.date, slotStart: existing.slotStart, slotEnd: existing.slotEnd, excludeId: String(existing._id) });
  }
  await Appointment.updateOne({ _id: existing._id }, { $set: { ...input, updatedBy: req.user!.id } });
  const full = await Appointment.findById(existing._id).populate(POPULATE).lean();
  ok(res, liftRefs(full as Record<string, unknown>, LIFT));
});

appointmentsRouter.post('/:id/status', requirePermission('appointments:write'), validate(appointmentStatusInput), async (req, res) => {
  const { status, cancelReason } = body<typeof appointmentStatusInput>(req);
  const set: Record<string, unknown> = { status, updatedBy: req.user!.id };
  if (status === 'Checked-in') set.checkedInAt = new Date();
  if (status === 'Completed') set.completedAt = new Date();
  if (status === 'Cancelled') set.cancelReason = cancelReason ?? 'Cancelled by clinic';
  const appt = await Appointment.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).populate(POPULATE).lean();
  if (!appt) throw notFound('Appointment not found');
  if (status === 'Completed' || status === 'In-treatment' || status === 'Checked-in') {
    await Patient.updateOne({ _id: appt.patientId }, { $set: { lastVisitAt: new Date() } });
  }
  ok(res, liftRefs(appt as Record<string, unknown>, LIFT));
});

appointmentsRouter.post('/:id/reschedule', requirePermission('appointments:write'), validate(appointmentReschedule), async (req, res) => {
  const input = body<typeof appointmentReschedule>(req);
  const existing = await Appointment.findById(req.params.id).lean();
  if (!existing) throw notFound('Appointment not found');
  if (['Completed', 'Cancelled'].includes(existing.status)) throw badRequest(`Cannot reschedule a ${existing.status.toLowerCase()} appointment`);
  const doctorId = input.doctorId ?? String(existing.doctorId);
  await assertNoDoctorClash({ doctorId, date: input.date, slotStart: input.slotStart, slotEnd: input.slotEnd, excludeId: String(existing._id) });
  await Appointment.updateOne(
    { _id: existing._id },
    {
      $set: { date: input.date, slotStart: input.slotStart, slotEnd: input.slotEnd, doctorId, startAt: combine(input.date, input.slotStart), status: 'Booked', remindersSent: [], updatedBy: req.user!.id },
      $push: { rescheduledFrom: { date: existing.date, slotStart: existing.slotStart, slotEnd: existing.slotEnd, at: new Date(), by: req.user!.id } },
    },
  );
  const full = await Appointment.findById(existing._id).populate(POPULATE).lean();
  ok(res, liftRefs(full as Record<string, unknown>, LIFT));
});

/** Doctor's own queue for today (mobile bedside view). */
appointmentsRouter.get('/queue/today', requirePermission('appointments:read'), async (req, res) => {
  const filter: Record<string, unknown> = { ...branchFilter(req), date: todayIso(), status: { $nin: ['Cancelled', 'No-show'] } };
  if (req.user!.role === 'DOCTOR') filter.doctorId = req.user!.id;
  const items = await Appointment.find(filter).populate(POPULATE).sort('slotStart').lean();
  ok(res, liftAll(items as Record<string, unknown>[], LIFT));
});
