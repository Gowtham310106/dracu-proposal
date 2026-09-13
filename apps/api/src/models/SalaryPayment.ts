import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAYMENT_MODES } from '@acuheal/types';

const salaryPaymentSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    month: { type: String, required: true, index: true }, // YYYY-MM
    amount: { type: Number, required: true, min: 1 },
    paidOn: { type: String, required: true },
    paidOnAt: { type: Date, required: true, index: true },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    reference: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type SalaryPaymentDoc = InferSchemaType<typeof salaryPaymentSchema> & { _id: Schema.Types.ObjectId };
export const SalaryPayment = model('SalaryPayment', salaryPaymentSchema);
