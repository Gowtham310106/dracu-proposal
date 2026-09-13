import { Schema, model, type InferSchemaType } from 'mongoose';
import { MESSAGE_STATUS, MESSAGE_TYPES } from '@acuheal/types';

const messageLogSchema = new Schema(
  {
    type: { type: String, enum: MESSAGE_TYPES, required: true, index: true },
    to: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    patientName: String,
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'MessageTemplate' },
    body: { type: String, required: true },
    status: { type: String, enum: MESSAGE_STATUS, default: 'Queued', index: true },
    provider: { type: String, required: true },
    providerMessageId: String,
    error: String,
    sentAt: Date,
    refType: String, // e.g. Appointment
    refId: String,
    /** idempotency key, e.g. reminder:<appointmentId>:day-before */
    dedupeKey: { type: String, unique: true, sparse: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type MessageLogDoc = InferSchemaType<typeof messageLogSchema> & { _id: Schema.Types.ObjectId };
export const MessageLog = model('MessageLog', messageLogSchema);
