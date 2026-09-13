import { z } from 'zod';
import {
  AFFECTED_REGIONS, BLOOD_GROUPS, CONDITIONS, CONTRAINDICATION_FLAGS, DURATION_UNITS, GENDERS, INDIAN_STATES,
  LANGUAGES, LIFESTYLES, MEDICAL_HISTORY, PATIENT_STATUS, PREVIOUS_TREATMENTS, REFERRAL_SOURCES, SLEEP_QUALITY,
} from '../enums.js';
import type { Timestamped } from '../api.js';
import {
  mobile, optionalMobile, optionalEmail, optionalIsoDate, optionalText, pincode, optionalNumber, optionalEnum, optionalObjectId,
} from './common.js';

export const patientInput = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  fullName: z.string().trim().min(2, 'Name is required').max(120),
  mobile,
  altMobile: optionalMobile,
  email: optionalEmail,
  dateOfBirth: optionalIsoDate,
  gender: z.enum(GENDERS),
  bloodGroup: optionalEnum(BLOOD_GROUPS),
  photoUrl: optionalText,

  addressLine: optionalText,
  area: optionalText,
  city: optionalText,
  state: optionalEnum(INDIAN_STATES),
  pincode,

  chiefComplaint: z.string().trim().min(3, 'Chief complaint is required').max(2000),
  conditions: z.array(z.enum(CONDITIONS)).default([]),
  complaintDurationValue: optionalNumber,
  complaintDurationUnit: optionalEnum(DURATION_UNITS),
  painScale: optionalNumber.pipe(z.number().int().min(0).max(10).optional()),
  affectedRegions: z.array(z.enum(AFFECTED_REGIONS)).default([]),
  diagnosisNotes: optionalText,
  previousTreatments: z.array(z.enum(PREVIOUS_TREATMENTS)).default([]),
  medicalHistory: z.array(z.enum(MEDICAL_HISTORY)).default([]),
  currentMedications: optionalText,
  allergies: optionalText,
  contraindicationFlags: z.array(z.enum(CONTRAINDICATION_FLAGS)).default([]),
  lifestyle: optionalEnum(LIFESTYLES),
  sleepQuality: optionalEnum(SLEEP_QUALITY),

  referralSource: z.enum(REFERRAL_SOURCES),
  referredBy: optionalText,
  leadId: optionalObjectId,

  preferredLanguage: optionalEnum(LANGUAGES),
  emergencyContactName: optionalText,
  emergencyContactMobile: optionalMobile,
  whatsappOptIn: z.coerce.boolean().default(true),
  consentGiven: z.coerce.boolean().refine((v) => v === true, 'Consent must be recorded'),
  status: z.enum(PATIENT_STATUS).default('Active'),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: optionalText,
});

export type PatientInput = z.infer<typeof patientInput>;

export const patientUpdate = patientInput.partial().extend({
  consentGiven: z.coerce.boolean().optional(),
});
export type PatientUpdate = z.infer<typeof patientUpdate>;

export interface Patient extends Omit<PatientInput, 'leadId'>, Timestamped {
  pid: string;
  age?: number;
  leadId?: string;
  consentSignedAt?: string;
  lastVisitAt?: string;
  activePackage?: { _id: string; packageNo: string; totalSessions: number; sessionsCompleted: number; balance: number } | null;
}

export const patientLookupQuery = z.object({ mobile });
