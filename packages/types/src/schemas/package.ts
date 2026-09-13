import { z } from 'zod';
import { PACKAGE_STATUS, PATIENT_RESPONSE, PRICING_MODES, SESSION_FREQUENCY, TECHNIQUES, TREATMENT_PRESETS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { isoDate, money, optionalIsoDate, optionalMoney, optionalNumber, optionalObjectId, optionalText, optionalEnum } from './common.js';

export const packageInput = z
  .object({
    patientId: z.string().min(1, 'Patient is required'),
    branchId: z.string().min(1),
    treatmentPlanName: z.enum(TREATMENT_PRESETS),
    customPlanName: optionalText,
    assignedDoctorId: optionalObjectId,
    totalSessions: z.coerce.number().int().min(1).max(200),
    sessionFrequency: z.enum(SESSION_FREQUENCY).default('Alternate days'),
    startDate: isoDate,
    expectedEndDate: optionalIsoDate,
    pricingMode: z.enum(PRICING_MODES),
    perSessionFee: optionalMoney,
    packageFee: optionalMoney,
    discount: money.default(0),
    status: z.enum(PACKAGE_STATUS).default('Active'),
    discontinueReason: optionalText,
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.pricingMode === 'Per-session' && (v.perSessionFee == null || v.perSessionFee <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['perSessionFee'], message: 'Per-session fee is required' });
    }
    if (v.pricingMode === 'Package' && (v.packageFee == null || v.packageFee <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['packageFee'], message: 'Package fee is required' });
    }
    if (v.treatmentPlanName === 'Custom' && !v.customPlanName) {
      ctx.addIssue({ code: 'custom', path: ['customPlanName'], message: 'Name the custom plan' });
    }
  });

export type PackageInput = z.infer<typeof packageInput>;
export const packageUpdate = z.object({
  assignedDoctorId: optionalObjectId,
  totalSessions: z.coerce.number().int().min(1).max(200).optional(),
  sessionFrequency: z.enum(SESSION_FREQUENCY).optional(),
  expectedEndDate: optionalIsoDate,
  discount: optionalMoney,
  perSessionFee: optionalMoney,
  packageFee: optionalMoney,
  status: z.enum(PACKAGE_STATUS).optional(),
  discontinueReason: optionalText,
  notes: optionalText,
});

export function computePackageTotal(p: { pricingMode: string; totalSessions: number; perSessionFee?: number; packageFee?: number; discount?: number }): number {
  const gross = p.pricingMode === 'Per-session' ? (p.perSessionFee ?? 0) * p.totalSessions : p.packageFee ?? 0;
  return Math.max(0, Math.round(gross - (p.discount ?? 0)));
}

export interface TreatmentPackage extends Omit<PackageInput, 'assignedDoctorId'>, Timestamped {
  packageNo: string;
  assignedDoctorId?: string;
  sessionsCompleted: number;
  totalPayable: number;
  totalPaid: number;
  balance: number;
  lastSessionAt?: string;
  patient?: { _id: string; pid: string; fullName: string; mobile: string };
  doctor?: { _id: string; fullName: string };
}

export const sessionLogInput = z.object({
  appointmentId: optionalObjectId,
  date: isoDate,
  doctorId: z.string().min(1, 'Doctor is required'),
  painScaleBefore: optionalNumber.pipe(z.number().int().min(0).max(10).optional()),
  painScaleAfter: optionalNumber.pipe(z.number().int().min(0).max(10).optional()),
  technique: z.array(z.enum(TECHNIQUES)).default([]),
  pointsUsed: z.array(z.string().trim().min(1).max(20)).default([]),
  needleRetentionMinutes: optionalNumber,
  observations: z.string().trim().min(2, 'Observations are required').max(4000),
  patientResponse: optionalEnum(PATIENT_RESPONSE),
  adverseEvents: optionalText,
  nextSessionAdvice: optionalText,
  mediaIds: z.array(z.string()).default([]),
});
export type SessionLogInput = z.infer<typeof sessionLogInput>;

export interface SessionLog extends Omit<SessionLogInput, 'appointmentId'>, Timestamped {
  packageId: string;
  patientId: string;
  branchId: string;
  appointmentId?: string;
  sessionNumber: number;
  doctor?: { _id: string; fullName: string };
}
