import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { attendanceManualInput, biometricPushInput, dateRangeQuery, isoDate, type BiometricPushInput } from '@acuheal/types';
import { AttendanceLog } from '../../models/AttendanceLog.js';
import { User } from '../../models/User.js';
import { Branch } from '../../models/Branch.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { requireApiKey, requirePermission } from '../../middleware/auth.js';
import { branchFilter } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { ok, created } from '../../utils/http.js';
import { combine, d, hhmmOf, minutesBetween, todayIso } from '../../utils/dates.js';
import { liftAll } from '../../utils/populate.js';

export const attendanceRouter = Router();
/** Public (API-key) router mounted before auth. */
export const biometricRouter = Router();

const HALF_DAY_MINUTES = 240;

function statusFor(worked: number, punches: number): 'Present' | 'Half-day' {
  if (punches <= 1) return 'Present';
  return worked < HALF_DAY_MINUTES ? 'Half-day' : 'Present';
}

/** Core punch processor shared by the push endpoint and the CSV importer. */
export async function processPunches(punches: BiometricPushInput['punches'], source: 'Biometric' | 'CSV') {
  const deviceIds = [...new Set(punches.map((p) => p.deviceUserId))];
  const users = await User.find({ biometricUserId: { $in: deviceIds } }).select('biometricUserId defaultBranchId').lean();
  const byDevice = new Map(users.map((u) => [u.biometricUserId!, u]));
  const branches = await Branch.find().select('code').lean();
  const branchByCode = new Map(branches.map((b) => [b.code, b._id]));

  const result = { processed: 0, unknownDeviceIds: [] as string[], days: 0 };
  const grouped = new Map<string, { staffId: unknown; branchId: unknown; deviceUserId: string; date: string; punches: { at: Date; direction: string }[] }>();

  for (const p of punches) {
    const user = byDevice.get(p.deviceUserId);
    if (!user) {
      if (!result.unknownDeviceIds.includes(p.deviceUserId)) result.unknownDeviceIds.push(p.deviceUserId);
      continue;
    }
    const at = new Date(p.timestamp);
    if (Number.isNaN(at.getTime())) continue;
    const date = d(at).format('YYYY-MM-DD');
    const key = `${String(user._id)}:${date}`;
    const branchId = (p.branchCode && branchByCode.get(p.branchCode.toUpperCase())) || user.defaultBranchId;
    const g = grouped.get(key) ?? { staffId: user._id, branchId, deviceUserId: p.deviceUserId, date, punches: [] };
    g.punches.push({ at, direction: p.direction ?? 'AUTO' });
    grouped.set(key, g);
    result.processed++;
  }

  for (const g of grouped.values()) {
    const existing = await AttendanceLog.findOne({ staffId: g.staffId, date: g.date });
    const all = [...(existing?.punches ?? []).map((x) => ({ at: new Date(x.at as Date), direction: String(x.direction ?? 'AUTO') })), ...g.punches];
    const dedup = Array.from(new Map(all.map((x) => [x.at.getTime(), x])).values()).sort((a, b) => a.at.getTime() - b.at.getTime());
    const first = dedup[0]!.at;
    const last = dedup[dedup.length - 1]!.at;
    const worked = dedup.length > 1 ? minutesBetween(first, last) : 0;
    await AttendanceLog.updateOne(
      { staffId: g.staffId, date: g.date },
      {
        $set: {
          branchId: g.branchId,
          deviceUserId: g.deviceUserId,
          firstPunchAt: first,
          lastPunchAt: last,
          checkIn: hhmmOf(first),
          checkOut: dedup.length > 1 ? hhmmOf(last) : undefined,
          workedMinutes: worked,
          status: existing?.status === 'Leave' ? 'Leave' : statusFor(worked, dedup.length),
          source,
          punches: dedup,
        },
      },
      { upsert: true },
    );
    result.days++;
  }
  return result;
}

biometricRouter.post('/push', requireApiKey(() => env.BIOMETRIC_API_KEY), validate(biometricPushInput), async (req, res) => {
  const input = body<typeof biometricPushInput>(req);
  const result = await processPunches(input.punches, 'Biometric');
  logger.info({ deviceId: input.deviceId, ...result }, 'biometric push processed');
  ok(res, result);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
attendanceRouter.post('/import-csv', requirePermission('attendance:manage'), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Upload a CSV file in the "file" field');
  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer.toString('utf8'), { columns: (h: string[]) => h.map((c) => c.trim()), skip_empty_lines: true, trim: true });
  } catch (e) {
    throw badRequest(`Could not parse CSV: ${(e as Error).message}`);
  }
  const punches = records
    .map((r) => {
      const pick = (...names: string[]) => names.map((n) => r[n] ?? r[n.toLowerCase()] ?? r[n.toUpperCase()]).find((v) => v !== undefined && v !== '');
      return { deviceUserId: pick('deviceUserId', 'userid', 'user_id', 'EmpCode', 'empcode', 'id') ?? '', timestamp: pick('timestamp', 'time', 'datetime', 'punch_time', 'PunchTime') ?? '', branchCode: pick('branchCode', 'branch'), direction: (pick('direction', 'type', 'inout') ?? 'AUTO').toUpperCase() };
    })
    .filter((p) => p.deviceUserId && p.timestamp)
    .map((p) => ({ ...p, direction: (['IN', 'OUT'].includes(p.direction) ? p.direction : 'AUTO') as 'IN' | 'OUT' | 'AUTO' }));
  if (!punches.length) throw badRequest('No rows with deviceUserId and timestamp found');
  ok(res, { rows: records.length, ...(await processPunches(punches, 'CSV')) });
});

/** Day view: every active staff member in scope with their log (or Absent). */
const dayViewQuery = z.object({ date: isoDate.optional() });
attendanceRouter.get('/day', requirePermission('attendance:read'), validate(dayViewQuery, 'query'), async (req, res) => {
  const date = query<typeof dayViewQuery>(req).date ?? todayIso();
  const staffFilter: Record<string, unknown> = { active: true };
  if (req.branchId) staffFilter.branchIds = req.branchId;
  if (req.user!.role === 'DOCTOR' || req.user!.role === 'FRONT_DESK') staffFilter._id = req.user!.id;
  const staff = await User.find(staffFilter).select('fullName role employeeCode defaultBranchId biometricUserId').sort('fullName').lean();
  const logs = await AttendanceLog.find({ date, staffId: { $in: staff.map((s) => s._id) } }).lean();
  const byStaff = new Map(logs.map((l) => [String(l.staffId), l]));
  ok(res, {
    date,
    rows: staff.map((s) => {
      const log = byStaff.get(String(s._id));
      return { staff: { _id: String(s._id), fullName: s.fullName, role: s.role, employeeCode: s.employeeCode, biometricUserId: s.biometricUserId }, log: log ?? null, status: log?.status ?? 'Absent' };
    }),
  });
});

attendanceRouter.get('/summary', requirePermission('attendance:read'), validate(dateRangeQuery, 'query'), async (req, res) => {
  const q = query<typeof dateRangeQuery>(req);
  const from = q.from ?? d().startOf('month').format('YYYY-MM-DD');
  const to = q.to ?? todayIso();
  const match: Record<string, unknown> = { date: { $gte: from, $lte: to }, ...branchFilter(req) };
  if (req.user!.role === 'DOCTOR' || req.user!.role === 'FRONT_DESK') match.staffId = req.user!.id;
  const rows = await AttendanceLog.aggregate<{ _id: unknown; present: number; halfDay: number; leave: number; workedMinutes: number }>([
    { $match: match },
    {
      $group: {
        _id: '$staffId',
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half-day'] }, 1, 0] } },
        leave: { $sum: { $cond: [{ $eq: ['$status', 'Leave'] }, 1, 0] } },
        workedMinutes: { $sum: '$workedMinutes' },
      },
    },
  ]);
  const staff = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('fullName role employeeCode').lean();
  const names = new Map(staff.map((s) => [String(s._id), s]));
  ok(res, { from, to, rows: rows.map((r) => ({ staffId: String(r._id), staffName: names.get(String(r._id))?.fullName ?? '—', role: names.get(String(r._id))?.role, ...r, _id: undefined })) });
});

attendanceRouter.post('/manual', requirePermission('attendance:manage'), validate(attendanceManualInput), async (req, res) => {
  const input = body<typeof attendanceManualInput>(req);
  const checkInAt = input.checkIn ? combine(input.date, input.checkIn) : undefined;
  const checkOutAt = input.checkOut ? combine(input.date, input.checkOut) : undefined;
  const worked = checkInAt && checkOutAt ? minutesBetween(checkInAt, checkOutAt) : 0;
  const log = await AttendanceLog.findOneAndUpdate(
    { staffId: input.staffId, date: input.date },
    { $set: { branchId: input.branchId, checkIn: input.checkIn, checkOut: input.checkOut, firstPunchAt: checkInAt, lastPunchAt: checkOutAt, workedMinutes: worked, status: input.status, source: 'Manual', remarks: input.remarks, updatedBy: req.user!.id }, $setOnInsert: { createdBy: req.user!.id } },
    { upsert: true, new: true },
  ).lean();
  created(res, log);
});

attendanceRouter.get('/', requirePermission('attendance:read'), validate(dateRangeQuery.extend({ staffId: z.string().optional() }), 'query'), async (req, res) => {
  const q = query<z.ZodObject<z.ZodRawShape>>(req) as { from?: string; to?: string; staffId?: string };
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.staffId) filter.staffId = q.staffId;
  if (req.user!.role === 'DOCTOR' || req.user!.role === 'FRONT_DESK') filter.staffId = req.user!.id;
  const items = await AttendanceLog.find(filter).populate('staffId', 'fullName role').sort('-date').limit(500).lean();
  ok(res, liftAll(items as Record<string, unknown>[], { staffId: 'staff' }));
});

attendanceRouter.delete('/:id', requirePermission('attendance:manage'), async (req, res) => {
  const log = await AttendanceLog.findByIdAndDelete(req.params.id).lean();
  if (!log) throw notFound('Attendance record not found');
  ok(res, { deleted: true });
});
