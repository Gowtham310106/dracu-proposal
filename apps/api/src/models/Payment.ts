import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAYMENT_MODES } from '@acuheal/types';

const paymentSchema = new Schema(
  {
    receiptNo: { type: String, required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'TreatmentPackage', index: true },
    amount: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    date: { type: String, required: true, index: true },
    dateAt: { type: Date, required: true, index: true },
    reference: String,
    remarks: String,
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Schema.Types.ObjectId };
export const Payment = model('Payment', paymentSchema);
