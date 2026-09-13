import { Schema, model, type InferSchemaType } from 'mongoose';
import { INVOICE_ITEM_TYPES, PAYMENT_STATUS } from '@acuheal/types';

const invoiceSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'TreatmentPackage' },
    date: { type: String, required: true, index: true },
    dateAt: { type: Date, required: true, index: true },
    items: [
      {
        description: { type: String, required: true },
        type: { type: String, enum: INVOICE_ITEM_TYPES, default: 'Session' },
        qty: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true },
        _id: false,
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'Unpaid', index: true },
    notes: String,
    printedCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { _id: Schema.Types.ObjectId };
export const Invoice = model('Invoice', invoiceSchema);
