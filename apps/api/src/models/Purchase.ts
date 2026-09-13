import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAYMENT_STATUS } from '@acuheal/types';

const purchaseSchema = new Schema(
  {
    purchaseNo: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    date: { type: String, required: true, index: true },
    dateAt: { type: Date, required: true, index: true },
    items: [
      {
        name: { type: String, required: true },
        qty: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true },
        _id: false,
      },
    ],
    total: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'Unpaid', index: true },
    dueDate: String,
    billNo: String,
    attachmentUrl: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type PurchaseDoc = InferSchemaType<typeof purchaseSchema> & { _id: Schema.Types.ObjectId };
export const Purchase = model('Purchase', purchaseSchema);
