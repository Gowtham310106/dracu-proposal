import { Schema, model, type InferSchemaType } from 'mongoose';
import { FOLLOW_UP_CHANNELS, LEAD_SOURCES, LEAD_STATUS, TREATMENT_PRESETS } from '@acuheal/types';

const leadSchema = new Schema(
  {
    leadNo: { type: String, required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, index: true },
    source: { type: String, enum: LEAD_SOURCES, required: true, index: true },
    campaign: String,
    interestedIn: { type: String, enum: TREATMENT_PRESETS },
    complaintSummary: String,
    status: { type: String, enum: LEAD_STATUS, default: 'New', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    nextFollowUpAt: { type: Date, index: true },
    lostReason: String,
    followUps: [
      {
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        byName: String,
        channel: { type: String, enum: FOLLOW_UP_CHANNELS },
        outcome: String,
        note: String,
      },
    ],
    convertedPatientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    convertedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type LeadDoc = InferSchemaType<typeof leadSchema> & { _id: Schema.Types.ObjectId };
export const Lead = model('Lead', leadSchema);
