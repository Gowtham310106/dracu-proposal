import { EXPENSE_CATEGORIES, PAYMENT_MODES, PAYMENT_STATUS, VENDOR_CATEGORIES } from '../enums.js';
import type { FormDefinition } from './types.js';

export const EXPENSE_FORM: FormDefinition = {
  entity: 'expense',
  title: 'Record expense',
  sections: [{ id: 'e', title: 'Expense' }],
  fields: [
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'e', required: true, width: 'third' },
    { key: 'date', label: 'Date', type: 'date', section: 'e', required: true, width: 'third' },
    { key: 'category', label: 'Category', type: 'select', section: 'e', required: true, options: EXPENSE_CATEGORIES, width: 'third' },
    { key: 'description', label: 'Description', type: 'text', section: 'e', required: true, width: 'two-thirds' },
    { key: 'amount', label: 'Amount (₹)', type: 'money', section: 'e', required: true, min: 1, width: 'third' },
    { key: 'mode', label: 'Paid via', type: 'select', section: 'e', required: true, options: PAYMENT_MODES, width: 'third', defaultValue: 'Cash' },
    { key: 'vendorId', label: 'Vendor', type: 'vendor', section: 'e', width: 'third' },
    { key: 'billNo', label: 'Bill no.', type: 'text', section: 'e', width: 'third' },
    { key: 'paidBy', label: 'Paid by', type: 'staff', section: 'e', width: 'third' },
    { key: 'attachmentUrl', label: 'Bill attachment', type: 'file', section: 'e', width: 'two-thirds' },
  ],
};

export const VENDOR_FORM: FormDefinition = {
  entity: 'vendor',
  title: 'Vendor',
  sections: [{ id: 'v', title: 'Vendor details' }],
  fields: [
    { key: 'name', label: 'Vendor name', type: 'text', section: 'v', required: true, width: 'third' },
    { key: 'contactPerson', label: 'Contact person', type: 'text', section: 'v', width: 'third' },
    { key: 'mobile', label: 'Mobile', type: 'mobile', section: 'v', required: true, width: 'third' },
    { key: 'email', label: 'Email', type: 'email', section: 'v', width: 'third' },
    { key: 'gstin', label: 'GSTIN', type: 'text', section: 'v', width: 'third' },
    { key: 'category', label: 'Categories', type: 'multiselect', section: 'v', options: VENDOR_CATEGORIES, width: 'third' },
    { key: 'address', label: 'Address', type: 'text', section: 'v', width: 'two-thirds' },
    { key: 'active', label: 'Active', type: 'checkbox', section: 'v', width: 'third', defaultValue: true },
    { key: 'notes', label: 'Notes', type: 'textarea', section: 'v', width: 'full' },
  ],
};

export const PURCHASE_FORM: FormDefinition = {
  entity: 'purchase',
  title: 'Record purchase',
  sections: [
    { id: 'p', title: 'Purchase' },
    { id: 'items', title: 'Items', description: 'Line items with qty and unit price. Total is computed.' },
    { id: 'pay', title: 'Payment' },
  ],
  fields: [
    { key: 'vendorId', label: 'Vendor', type: 'vendor', section: 'p', required: true, width: 'third' },
    { key: 'branchId', label: 'Branch', type: 'branch', section: 'p', required: true, width: 'third' },
    { key: 'date', label: 'Date', type: 'date', section: 'p', required: true, width: 'third' },
    { key: 'billNo', label: 'Vendor bill no.', type: 'text', section: 'p', width: 'third' },
    { key: 'attachmentUrl', label: 'Bill attachment', type: 'file', section: 'p', width: 'two-thirds' },
    { key: 'paidAmount', label: 'Paid amount (₹)', type: 'money', section: 'pay', min: 0, width: 'third', defaultValue: 0 },
    { key: 'paymentStatus', label: 'Payment status', type: 'select', section: 'pay', options: PAYMENT_STATUS, width: 'third', defaultValue: 'Unpaid' },
    { key: 'dueDate', label: 'Due date', type: 'date', section: 'pay', width: 'third' },
  ],
};
