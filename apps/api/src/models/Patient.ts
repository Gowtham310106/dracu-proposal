import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  AFFECTED_REGIONS, BLOOD_GROUPS, CONDITIONS, CONTRAINDICATION_FLAGS, DURATION_UNITS, GENDERS, LANGUAGES, LIFESTYLES,
  MEDICAL_HISTORY, PATIENT_STATUS, PREVIOUS_TREATMENTS, REFERRAL_SOURCES, SLEEP_QUALITY,
} from '@acuheal/types';

const patientSchema = new Schema(
  {
    pid: { type: String, required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, index: true },
    altMobile: String,
    email: String,
    dateOfBirth: Date,
    gender: { type: String, enum: GENDERS, required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS },
    photoUrl: String,

    addressLine: String,
    area: String,
    city: String,
    state: String,
    pincode: String,

    chiefComplaint: { type: String, required: true },
    conditions: { type: [String], enum: CONDITIONS, default: [] },
    complaintDurationValue: Number,
    complaintDurationUnit: { type: String, enum: DURATION_UNITS },
    painScale: Number,
    affectedRegions: { type: [String], enum: AFFECTED_REGIONS, default: [] },
    diagnosisNotes: String,
    previousTreatments: { type: [String], enum: PREVIOUS_TREATMENTS, default: [] },
    medicalHistory: { type: [String], enum: MEDICAL_HISTORY, default: [] },
    currentMedications: String,
    allergies: String,
    contraindicationFlags: { type: [String], enum: CONTRAINDICATION_FLAGS, default: [] },
    lifestyle: { type: String, enum: LIFESTYLES },
    sleepQuality: { type: String, enum: SLEEP_QUALITY },

    referralSource: { type: String, enum: REFERRAL_SOURCES, required: true },
    referredBy: String,
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },

    preferredLanguage: { type: String, enum: LANGUAGES, default: 'Tamil' },
    emergencyContactName: String,
    emergencyContactMobile: String,
    whatsappOptIn: { type: Boolean, default: true },
    consentGiven: { type: Boolean, default: false },
    consentSignedAt: Date,
    status: { type: String, enum: PATIENT_STATUS, default: 'Active', index: true },
    tags: { type: [String], default: [] },
    notes: String,
    lastVisitAt: Date,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

patientSchema.index({ fullName: 'text', pid: 'text', mobile: 'text' });
patientSchema.index({ branchId: 1, createdAt: -1 });

export type PatientDoc = InferSchemaType<typeof patientSchema> & { _id: Schema.Types.ObjectId };
export const Patient = model('Patient', patientSchema);
