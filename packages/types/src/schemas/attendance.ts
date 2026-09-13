import { z } from 'zod';
import { ATTENDANCE_SOURCES, ATTENDANCE_STATUS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { isoDate, optionalHhmm, optionalText } from './common.js';

export const attendanceManualInput = z.object({
  staffId: z.string().min(1),
  branchId: z.string().min(1),
  date: isoDate,
  checkIn: optionalHhmm,
  checkOut: optionalHhmm,
  status: z.enum(ATTENDANCE_STATUS).default('Present'),
  remarks: optionalText,
});
export type AttendanceManualInput = z.infer<typeof attendanceManualInput>;

/** One punch from a biometric device (or CSV row). */
export const biometricPunch = z.object({
  deviceUserId: z.string().trim().min(1),
  timestamp: z.string().min(10),
  branchCode: z.string().trim().min(2).max(4).optional(),
  direction: z.enum(['IN', 'OUT', 'AUTO']).default('AUTO'),
});
export const biometricPushInput = z.object({
  deviceId: z.string().optional(),
  punches: z.array(biometricPunch).min(1).max(5000),
});
export type BiometricPushInput = z.infer<typeof biometricPushInput>;

export interface AttendanceLog extends Timestamped {
  staffId: string;
  staffName?: string;
  branchId?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workedMinutes: number;
  status: (typeof ATTENDANCE_STATUS)[number];
  source: (typeof ATTENDANCE_SOURCES)[number];
  deviceUserId?: string;
  remarks?: string;
  punches?: { at: string; direction: string }[];
}

export interface AttendanceSummary {
  staffId: string;
  staffName: string;
  branchId?: string;
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  workedMinutes: number;
}
