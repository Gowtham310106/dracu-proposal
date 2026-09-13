import { z } from 'zod';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES } from '../enums.js';
import type { Timestamped } from '../api.js';
import { hhmm, isoDate, optionalObjectId, optionalText } from './common.js';

export const appointmentInput = z
  .object({
    branchId: z.string().min(1),
    patientId: z.string().min(1, 'Patient is required'),
    doctorId: z.string().min(1, 'Doctor is required'),
    date: isoDate,
    slotStart: hhmm,
    slotEnd: hhmm,
    type: z.enum(APPOINTMENT_TYPES).default('Consultation'),
    treatmentPackageId: optionalObjectId,
    status: z.enum(APPOINTMENT_STATUS).default('Booked'),
    reason: optionalText,
    notes: optionalText,
  })
  .refine((v) => v.slotEnd > v.slotStart, { message: 'Slot end must be after start', path: ['slotEnd'] });

export type AppointmentInput = z.infer<typeof appointmentInput>;

export const appointmentUpdate = z.object({
  doctorId: z.string().min(1).optional(),
  type: z.enum(APPOINTMENT_TYPES).optional(),
  treatmentPackageId: optionalObjectId,
  reason: optionalText,
  notes: optionalText,
});

export const appointmentStatusInput = z.object({
  status: z.enum(APPOINTMENT_STATUS),
  cancelReason: optionalText,
});

export const appointmentReschedule = z
  .object({ date: isoDate, slotStart: hhmm, slotEnd: hhmm, doctorId: z.string().min(1).optional(), reason: optionalText })
  .refine((v) => v.slotEnd > v.slotStart, { message: 'Slot end must be after start', path: ['slotEnd'] });

export const dayQuery = z.object({ date: isoDate, branchId: z.string().optional(), doctorId: z.string().optional() });

export interface Appointment extends Omit<AppointmentInput, 'treatmentPackageId'>, Timestamped {
  treatmentPackageId?: string;
  cancelReason?: string;
  rescheduledFrom?: { date: string; slotStart: string; slotEnd: string; at: string; by?: string }[];
  remindersSent?: { type: string; at: string }[];
  checkedInAt?: string;
  completedAt?: string;
  patient?: { _id: string; pid: string; fullName: string; mobile: string; photoUrl?: string; contraindicationFlags?: string[] };
  doctor?: { _id: string; fullName: string };
  package?: { _id: string; packageNo: string; totalSessions: number; sessionsCompleted: number; balance: number; treatmentPlanName: string; customPlanName?: string } | null;
}

export interface Slot { start: string; end: string; booked: number; appointments: string[] }
