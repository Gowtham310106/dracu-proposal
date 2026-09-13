import { Schema, model, type InferSchemaType } from 'mongoose';
import { INDIAN_STATES, WEEK_DAYS } from '@acuheal/types';

const branchSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    whatsappNumber: String,
    gstin: String,
    address: String,
    city: String,
    state: { type: String, enum: INDIAN_STATES },
    active: { type: Boolean, default: true },
    workingDays: { type: [String], enum: WEEK_DAYS, default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    workingHours: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '20:00' },
    },
    slotDurationMinutes: { type: Number, default: 30 },
    reminderHour: { type: Number, default: 18 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type BranchDoc = InferSchemaType<typeof branchSchema> & { _id: Schema.Types.ObjectId };
export const Branch = model('Branch', branchSchema);
