import { z } from 'zod';
import { EXPENSE_CATEGORIES, PAYMENT_MODES, PAYMENT_STATUS, VENDOR_CATEGORIES } from '../enums.js';
import type { Timestamped } from '../api.js';
import { isoDate, mobile, money, optionalEmail, optionalIsoDate, optionalObjectId, optionalText } from './common.js';

export const expenseInput = z.object({
  branchId: z.string().min(1),
  date: isoDate,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1).max(300),
  amount: money.refine((v) => v > 0, 'Amount must be positive'),
  mode: z.enum(PAYMENT_MODES).default('Cash'),
  vendorId: optionalObjectId,
  billNo: optionalText,
  paidBy: optionalObjectId,
  attachmentUrl: optionalText,
});
export type ExpenseInput = z.infer<typeof expenseInput>;
export interface Expense extends Omit<ExpenseInput, 'vendorId' | 'paidBy'>, Timestamped {
  vendorId?: string;
  vendorName?: string;
  paidBy?: string;
  paidByName?: string;
}

export const vendorInput = z.object({
  name: z.string().trim().min(2).max(150),
  contactPerson: optionalText,
  mobile,
  email: optionalEmail,
  gstin: optionalText,
  address: optionalText,
  category: z.array(z.enum(VENDOR_CATEGORIES)).default([]),
  notes: optionalText,
  active: z.coerce.boolean().default(true),
});
export type VendorInput = z.infer<typeof vendorInput>;
export interface Vendor extends VendorInput, Timestamped { totalPurchased?: number; totalOutstanding?: number }

export const purchaseItem = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.coerce.number().min(0.01).max(100000).default(1),
  unitPrice: money,
});
export const purchaseInput = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  branchId: z.string().min(1),
  date: isoDate,
  items: z.array(purchaseItem).min(1, 'Add at least one item'),
  billNo: optionalText,
  attachmentUrl: optionalText,
  paidAmount: money.default(0),
  paymentStatus: z.enum(PAYMENT_STATUS).default('Unpaid'),
  dueDate: optionalIsoDate,
});
export type PurchaseInput = z.infer<typeof purchaseInput>;
export interface Purchase extends Omit<PurchaseInput, 'items'>, Timestamped {
  purchaseNo: string;
  items: (z.infer<typeof purchaseItem> & { amount: number })[];
  total: number;
  vendorName?: string;
}

export const dateRangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  branchId: z.string().optional(),
});
