import cron from 'node-cron';
import { Appointment } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { TreatmentPackage } from '../models/TreatmentPackage.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { activeTemplate, renderTemplate, sendMessage } from '../modules/messaging/messaging.service.js';
import { addDaysIso, d, todayIso } from '../utils/dates.js';

export interface JobResult { sent: number; skipped: number; failed: number }

/**
 * Session reminders.
 *  kind = 'day-before' -> appointments tomorrow (run at each branch's reminderHour)
 *  kind = 'same-day'   -> appointments today (run in the morning)
 */
export async function runReminders(kind: 'day-before' | 'same-day', opts: { force?: boolean; branchId?: string } = {}): Promise<JobResult> {
  const result: JobResult = { sent: 0, skipped: 0, failed: 0 };
  const date = kind === 'day-before' ? addDaysIso(todayIso(), 1) : todayIso();
  const hour = d().hour();
  const branches = await Branch.find({ active: true, ...(opts.branchId ? { _id: opts.branchId } : {}) }).lean();
  for (const branch of branches) {
    if (!opts.force && kind === 'day-before' && (branch.reminderHour ?? 18) !== hour) continue;
    const appts = await Appointment.find({ branchId: branch._id, date, status: 'Booked' })
      .populate('patientId', 'fullName mobile whatsappOptIn preferredLanguage')
      .populate('doctorId', 'fullName')
      .populate('treatmentPackageId', 'sessionsCompleted totalSessions balance')
      .lean();
    for (const a of appts) {
      const patient = a.patientId as unknown as { _id: unknown; fullName: string; mobile: string; whatsappOptIn?: boolean; preferredLanguage?: string } | null;
      if (!patient || patient.whatsappOptIn === false) {
        result.skipped++;
        continue;
      }
      const tpl = await activeTemplate('SESSION_REMINDER', patient.preferredLanguage);
      if (!tpl) {
        result.skipped++;
        continue;
      }
      const pkg = a.treatmentPackageId as unknown as { sessionsCompleted: number; totalSessions: number; balance: number } | null;
      const text = renderTemplate(tpl.body, {
        patientName: patient.fullName,
        branchName: branch.name,
        branchPhone: branch.phone,
        date: d(a.startAt).format('DD MMM YYYY'),
        time: a.slotStart,
        doctorName: (a.doctorId as unknown as { fullName?: string })?.fullName ?? '',
        sessionNo: pkg ? pkg.sessionsCompleted + 1 : '',
        totalSessions: pkg?.totalSessions ?? '',
        balance: pkg?.balance ?? '',
      });
      const log = await sendMessage({ type: 'SESSION_REMINDER', to: patient.mobile, body: text, patientId: String(patient._id), patientName: patient.fullName, branchId: String(branch._id), templateId: String(tpl._id), refType: 'Appointment', refId: String(a._id), dedupeKey: `reminder:${String(a._id)}:${kind}` });
      if (!log) result.skipped++;
      else if (log.status === 'Sent') {
        result.sent++;
        await Appointment.updateOne({ _id: a._id }, { $push: { remindersSent: { type: kind, at: new Date() } } });
      } else result.failed++;
    }
  }
  logger.info({ kind, ...result }, 'reminders job done');
  return result;
}

/** Birthday greetings for patients whose DOB month/day is today. */
export async function runBirthdays(): Promise<JobResult> {
  const result: JobResult = { sent: 0, skipped: 0, failed: 0 };
  const now = d();
  const month = now.month() + 1;
  const day = now.date();
  const patients = await Patient.aggregate<{ _id: unknown; fullName: string; mobile: string; branchId: unknown; preferredLanguage?: string; whatsappOptIn?: boolean }>([
    { $match: { status: 'Active', dateOfBirth: { $ne: null } } },
    { $addFields: { m: { $month: { date: '$dateOfBirth', timezone: env.TZ } }, dd: { $dayOfMonth: { date: '$dateOfBirth', timezone: env.TZ } } } },
    { $match: { m: month, dd: day } },
    { $project: { fullName: 1, mobile: 1, branchId: 1, preferredLanguage: 1, whatsappOptIn: 1 } },
  ]);
  const branches = new Map((await Branch.find().lean()).map((b) => [String(b._id), b]));
  for (const p of patients) {
    if (p.whatsappOptIn === false) {
      result.skipped++;
      continue;
    }
    const tpl = await activeTemplate('BIRTHDAY', p.preferredLanguage);
    if (!tpl) {
      result.skipped++;
      continue;
    }
    const branch = branches.get(String(p.branchId));
    const text = renderTemplate(tpl.body, { patientName: p.fullName, branchName: branch?.name, branchPhone: branch?.phone });
    const log = await sendMessage({ type: 'BIRTHDAY', to: p.mobile, body: text, patientId: String(p._id), patientName: p.fullName, branchId: String(p.branchId), templateId: String(tpl._id), dedupeKey: `birthday:${String(p._id)}:${now.year()}` });
    if (!log) result.skipped++;
    else if (log.status === 'Sent') result.sent++;
    else result.failed++;
  }
  logger.info(result, 'birthdays job done');
  return result;
}

/** Follow-up nudges for front-desk are surfaced in the UI; this job only marks overdue packages as needing attention (no-op placeholder for future). */
export async function runHousekeeping(): Promise<{ staleDoctors: number; overduePackages: number }> {
  const [staleDoctors, overduePackages] = await Promise.all([
    User.countDocuments({ role: 'DOCTOR', active: true, lastLoginAt: { $lt: d().subtract(30, 'day').toDate() } }),
    TreatmentPackage.countDocuments({ status: 'Active', expectedEndDate: { $lt: todayIso() } }),
  ]);
  return { staleDoctors, overduePackages };
}

/** In-process schedule (works on always-on hosts; external cron can also hit the /jobs endpoints). */
export function startCron(): void {
  // every hour at :05 -> day-before reminders for branches whose reminderHour == now
  cron.schedule('5 * * * *', () => void runReminders('day-before').catch((err) => logger.error({ err }, 'reminders cron failed')), { timezone: env.TZ });
  // 08:00 daily -> same-day reminders + birthdays
  cron.schedule('0 8 * * *', () => {
    void runReminders('same-day').catch((err) => logger.error({ err }, 'same-day cron failed'));
    void runBirthdays().catch((err) => logger.error({ err }, 'birthday cron failed'));
  }, { timezone: env.TZ });
  logger.info('cron scheduled (reminders hourly, birthdays 08:00)');
}
