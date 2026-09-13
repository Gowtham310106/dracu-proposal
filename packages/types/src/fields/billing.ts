import { INVOICE_ITEM_TYPES, PAYMENT_MODES } from '../enums.js';
import type { FormDefinition } from './types.js';

export const INVOICE_FORM: FormDefinition = {
  entity: 'invoice',
  title: 'New invoice',
  sections: [
    { id: 'header', title: 'Invoice' },
    { id: 'items', title: 'Items', description: 'Add consultation, sessions, packages or products. Amounts are computed live.' },
    { id: 'totals', title: 'Totals' },
  ],
  fields: [
    { key: 'invoiceNo', label: 'Invoice no.', type: 'text', section: 'header', computed: true, width: 'third', helpText: 'Branch-prefixed sequential number' },
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'header', required: true, width: 'third' },
    { key: 'date', label: 'Date', type: 'date', section: 'header', required: true, width: 'third' },
    { key: 'patientId', label: 'Patient', type: 'patient', section: 'header', required: true, width: 'half' },
    { key: 'packageId', label: 'Against package', type: 'package', section: 'header', width: 'half', helpText: 'Optional: links payment to a treatment package' },
    { key: 'discount', label: 'Discount (₹)', type: 'money', section: 'totals', min: 0, width: 'third', defaultValue: 0 },
    { key: 'taxPercent', label: 'Tax %', type: 'number', section: 'totals', min: 0, max: 28, step: 0.5, width: 'third', defaultValue: 0 },
    { key: 'notes', label: 'Notes on invoice', type: 'text', section: 'totals', width: 'third' },
  ],
};

export const INVOICE_ITEM_FIELDS = {
  description: { label: 'Description', required: true },
  type: { label: 'Type', options: INVOICE_ITEM_TYPES },
  qty: { label: 'Qty', min: 1 },
  unitPrice: { label: 'Unit price (₹)', min: 0 },
} as const;

export const PAYMENT_FORM: FormDefinition = {
  entity: 'payment',
  title: 'Record payment',
  sections: [{ id: 'payment', title: 'Payment' }],
  fields: [
    { key: 'amount', label: 'Amount (₹)', type: 'money', section: 'payment', required: true, min: 1, width: 'third' },
    { key: 'mode', label: 'Mode', type: 'select', section: 'payment', required: true, options: PAYMENT_MODES, width: 'third', defaultValue: 'Cash' },
    { key: 'date', label: 'Date', type: 'date', section: 'payment', required: true, width: 'third' },
    { key: 'reference', label: 'Reference / UTR', type: 'text', section: 'payment', width: 'half', showIf: { key: 'mode', equals: ['UPI', 'Card', 'Bank transfer'] } },
    { key: 'remarks', label: 'Remarks', type: 'text', section: 'payment', width: 'half' },
  ],
};
