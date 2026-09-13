import { Schema, model, type InferSchemaType } from 'mongoose';
import { PATIENT_RESPONSE, TECHNIQUES } from '@acuheal/types';

const sessionLogSchema = new Schema(
  {
    packageId: { type: Schema.Types.ObjectId, ref: 'TreatmentPackage', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    sessionNumber: { type: Number, required: true },
    date: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    painScaleBefore: Number,
    painScaleAfter: Number,
    technique: { type: [String], enum: TECHNIQUES, default: [] },
    pointsUsed: { type: [String], default: [] },
    needleRetentionMinutes: Number,
    observations: { type: String, required: true },
    patientResponse: { type: String, enum: PATIENT_RESPONSE },
    adverseEvents: String,
    nextSessionAdvice: String,
    mediaIds: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

sessionLogSchema.index({ packageId: 1, sessionNumber: 1 }, { unique: true });

export type SessionLogDoc = InferSchemaType<typeof sessionLogSchema> & { _id: Schema.Types.ObjectId };
export const SessionLog = model('SessionLog', sessionLogSchema);
