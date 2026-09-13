import { Schema, model, type InferSchemaType } from 'mongoose';
import { PACKAGE_STATUS, PRICING_MODES, SESSION_FREQUENCY, TREATMENT_PRESETS } from '@acuheal/types';

const packageSchema = new Schema(
  {
    packageNo: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    treatmentPlanName: { type: String, enum: TREATMENT_PRESETS, required: true },
    customPlanName: String,
    assignedDoctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    totalSessions: { type: Number, required: true, min: 1 },
    sessionsCompleted: { type: Number, default: 0 },
    sessionFrequency: { type: String, enum: SESSION_FREQUENCY, default: 'Alternate days' },
    startDate: { type: String, required: true },
    expectedEndDate: String,
    pricingMode: { type: String, enum: PRICING_MODES, required: true },
    perSessionFee: Number,
    packageFee: Number,
    discount: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true },
    totalPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: { type: String, enum: PACKAGE_STATUS, default: 'Active', index: true },
    discontinueReason: String,
    notes: String,
    lastSessionAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type TreatmentPackageDoc = InferSchemaType<typeof packageSchema> & { _id: Schema.Types.ObjectId };
export const TreatmentPackage = model('TreatmentPackage', packageSchema);
