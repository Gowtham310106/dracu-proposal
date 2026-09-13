import { Schema, model, type InferSchemaType } from 'mongoose';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES } from '@acuheal/types';

const appointmentSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD in clinic tz
    slotStart: { type: String, required: true }, // HH:MM
    slotEnd: { type: String, required: true },
    startAt: { type: Date, required: true, index: true }, // instant for reminders
    type: { type: String, enum: APPOINTMENT_TYPES, default: 'Consultation' },
    treatmentPackageId: { type: Schema.Types.ObjectId, ref: 'TreatmentPackage' },
    status: { type: String, enum: APPOINTMENT_STATUS, default: 'Booked', index: true },
    reason: String,
    notes: String,
    cancelReason: String,
    checkedInAt: Date,
    completedAt: Date,
    rescheduledFrom: [
      {
        date: String,
        slotStart: String,
        slotEnd: String,
        at: Date,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        _id: false,
      },
    ],
    remindersSent: [{ type: { type: String }, at: Date, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ branchId: 1, date: 1, slotStart: 1 });
appointmentSchema.index({ doctorId: 1, date: 1 });

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema> & { _id: Schema.Types.ObjectId };
export const Appointment = model('Appointment', appointmentSchema);
