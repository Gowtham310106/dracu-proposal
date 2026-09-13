import { Schema, model, type InferSchemaType } from 'mongoose';
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from '@acuheal/types';

const expenseSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    date: { type: String, required: true, index: true },
    dateAt: { type: Date, required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    billNo: String,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    attachmentUrl: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & { _id: Schema.Types.ObjectId };
export const Expense = model('Expense', expenseSchema);
