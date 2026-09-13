import { Schema, model, type InferSchemaType } from 'mongoose';
import { MEDIA_CATEGORIES, MEDIA_KINDS } from '@acuheal/types';

const mediaSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    kind: { type: String, enum: MEDIA_KINDS, required: true, index: true },
    category: { type: String, enum: MEDIA_CATEGORIES, default: 'Progress' },
    sessionLogId: { type: Schema.Types.ObjectId, ref: 'SessionLog' },
    title: String,
    notes: String,
    storageKey: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSec: Number,
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    capturedAt: Date,
    status: { type: String, enum: ['Pending', 'Ready'], default: 'Pending', index: true },
  },
  { timestamps: true, versionKey: false },
);

export type MediaDoc = InferSchemaType<typeof mediaSchema> & { _id: Schema.Types.ObjectId };
export const Media = model('Media', mediaSchema);
