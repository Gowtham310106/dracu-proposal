import { PAYMENT_MODES, PAY_CYCLES, ROLES, ROLE_LABELS } from '../enums.js';
import type { FormDefinition } from './types.js';

export const STAFF_FORM: FormDefinition = {
  entity: 'staff',
  title: 'Staff profile',
  sections: [
    { id: 'profile', title: 'Profile' },
    { id: 'access', title: 'Role & branch access' },
    { id: 'salary', title: 'Salary structure' },
    { id: 'bank', title: 'Bank details' },
  ],
  fields: [
    { key: 'employeeCode', label: 'Employee code', type: 'text', section: 'profile', computed: true, width: 'third' },
    { key: 'fullName', label: 'Full name', type: 'text', section: 'profile', required: true, width: 'third' },
    { key: 'mobile', label: 'Mobile', type: 'mobile', section: 'profile', required: true, width: 'third' },
    { key: 'email', label: 'Email (login)', type: 'email', section: 'profile', required: true, width: 'third' },
    { key: 'designation', label: 'Designation', type: 'text', section: 'profile', width: 'third', placeholder: 'Senior Acupuncturist' },
    { key: 'qualification', label: 'Qualification', type: 'text', section: 'profile', width: 'third' },
    { key: 'joiningDate', label: 'Joining date', type: 'date', section: 'profile', width: 'third' },
    { key: 'biometricUserId', label: 'Biometric user ID', type: 'text', section: 'profile', width: 'third', helpText: 'Enrolment ID on the attendance device' },
    { key: 'photoUrl', label: 'Photo', type: 'photo', section: 'profile', width: 'third' },

    { key: 'role', label: 'Role', type: 'select', section: 'access', required: true, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })), width: 'third' },
    { key: 'branchIds', label: 'Branches', type: 'multiselect', section: 'access', required: true, width: 'third', helpText: 'Front-desk & accounts are locked to their default branch' },
    { key: 'defaultBranchId', label: 'Default branch', type: 'branch', section: 'access', required: true, width: 'third' },
    { key: 'active', label: 'Active (can log in)', type: 'checkbox', section: 'access', width: 'third', defaultValue: true },
    { key: 'password', label: 'Password', type: 'text', section: 'access', width: 'third', helpText: 'Leave blank to keep unchanged' },

    { key: 'salary.basic', label: 'Basic (₹)', type: 'money', section: 'salary', min: 0, width: 'quarter', defaultValue: 0 },
    { key: 'salary.allowances', label: 'Allowances (₹)', type: 'money', section: 'salary', min: 0, width: 'quarter', defaultValue: 0 },
    { key: 'salary.deductions', label: 'Deductions (₹)', type: 'money', section: 'salary', min: 0, width: 'quarter', defaultValue: 0 },
    { key: 'salary.payCycle', label: 'Pay cycle', type: 'select', section: 'salary', options: PAY_CYCLES, width: 'quarter', defaultValue: 'Monthly' },

    { key: 'bankDetails.accountName', label: 'Account name', type: 'text', section: 'bank', width: 'quarter' },
    { key: 'bankDetails.accountNo', label: 'Account no.', type: 'text', section: 'bank', width: 'quarter' },
    { key: 'bankDetails.ifsc', label: 'IFSC', type: 'text', section: 'bank', width: 'quarter' },
    { key: 'bankDetails.upi', label: 'UPI ID', type: 'text', section: 'bank', width: 'quarter' },
  ],
};

export const SALARY_PAYMENT_FORM: FormDefinition = {
  entity: 'salaryPayment',
  title: 'Record salary payment',
  sections: [{ id: 'p', title: 'Payment' }],
  fields: [
    { key: 'month', label: 'Salary month', type: 'month', section: 'p', required: true, width: 'third' },
    { key: 'amount', label: 'Amount (₹)', type: 'money', section: 'p', required: true, min: 1, width: 'third' },
    { key: 'paidOn', label: 'Paid on', type: 'date', section: 'p', required: true, width: 'third' },
    { key: 'mode', label: 'Mode', type: 'select', section: 'p', required: true, options: PAYMENT_MODES, width: 'third', defaultValue: 'Bank transfer' },
    { key: 'reference', label: 'Reference', type: 'text', section: 'p', width: 'third' },
    { key: 'notes', label: 'Notes', type: 'text', section: 'p', width: 'third' },
  ],
};
