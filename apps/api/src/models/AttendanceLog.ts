import { Schema, model, type InferSchemaType } from 'mongoose';
import { ATTENDANCE_SOURCES, ATTENDANCE_STATUS } from '@acuheal/types';

const attendanceLogSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    checkIn: String, // HH:MM
    checkOut: String,
    firstPunchAt: Date,
    lastPunchAt: Date,
    workedMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'Present' },
    source: { type: String, enum: ATTENDANCE_SOURCES, default: 'Manual' },
    deviceUserId: String,
    remarks: String,
    punches: [{ at: Date, direction: String, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

attendanceLogSchema.index({ staffId: 1, date: 1 }, { unique: true });

export type AttendanceLogDoc = InferSchemaType<typeof attendanceLogSchema> & { _id: Schema.Types.ObjectId };
export const AttendanceLog = model('AttendanceLog', attendanceLogSchema);
