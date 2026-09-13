import { z } from 'zod';
import { INVOICE_ITEM_TYPES, PAYMENT_MODES, PAYMENT_STATUS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { isoDate, money, optionalObjectId, optionalText } from './common.js';

export const invoiceItem = z.object({
  description: z.string().trim().min(1, 'Description required').max(200),
  type: z.enum(INVOICE_ITEM_TYPES).default('Session'),
  qty: z.coerce.number().min(0.01).max(1000).default(1),
  unitPrice: money,
});
export type InvoiceItem = z.infer<typeof invoiceItem> & { amount: number };

export const invoiceInput = z.object({
  branchId: z.string().min(1),
  patientId: z.string().min(1, 'Patient is required'),
  packageId: optionalObjectId,
  date: isoDate,
  items: z.array(invoiceItem).min(1, 'Add at least one item'),
  discount: money.default(0),
  taxPercent: z.coerce.number().min(0).max(28).default(0),
  notes: optionalText,
  /** optional payment recorded together with the invoice */
  payment: z
    .object({ amount: money, mode: z.enum(PAYMENT_MODES), reference: optionalText, remarks: optionalText })
    .optional(),
});
export type InvoiceInput = z.infer<typeof invoiceInput>;

export function computeInvoiceTotals(inv: { items: { qty: number; unitPrice: number }[]; discount?: number; taxPercent?: number }) {
  const subtotal = inv.items.reduce((s, i) => s + Math.round(i.qty * i.unitPrice), 0);
  const discount = Math.min(inv.discount ?? 0, subtotal);
  const taxable = subtotal - discount;
  const taxAmount = Math.round((taxable * (inv.taxPercent ?? 0)) / 100);
  const grandTotal = taxable + taxAmount;
  return { subtotal, discount, taxAmount, grandTotal };
}

export interface Invoice extends Omit<InvoiceInput, 'items' | 'payment' | 'packageId'>, Timestamped {
  invoiceNo: string;
  packageId?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  paymentStatus: (typeof PAYMENT_STATUS)[number];
  printedCount: number;
  patient?: { _id: string; pid: string; fullName: string; mobile: string; addressLine?: string; city?: string };
  branch?: { _id: string; code: string; name: string; address?: string; city?: string; phone: string; gstin?: string };
  package?: { _id: string; packageNo: string; totalSessions: number; sessionsCompleted: number; balance: number; treatmentPlanName: string; customPlanName?: string } | null;
}

export const paymentInput = z
  .object({
    invoiceId: optionalObjectId,
    packageId: optionalObjectId,
    patientId: z.string().min(1).optional(),
    branchId: z.string().min(1).optional(),
    amount: money.refine((v) => v > 0, 'Amount must be positive'),
    mode: z.enum(PAYMENT_MODES),
    date: isoDate,
    reference: optionalText,
    remarks: optionalText,
  })
  .refine((v) => v.invoiceId || v.packageId, { message: 'Payment must be against an invoice or a package', path: ['invoiceId'] });
export type PaymentInput = z.infer<typeof paymentInput>;

export interface Payment extends Omit<PaymentInput, 'invoiceId' | 'packageId'>, Timestamped {
  receiptNo: string;
  invoiceId?: string;
  packageId?: string;
  patientId: string;
  branchId: string;
  receivedBy: string;
  receivedByName?: string;
}
