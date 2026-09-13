import { z } from 'zod';
import { PAYMENT_MODES, PAY_CYCLES, ROLES } from '../enums.js';
import type { Timestamped } from '../api.js';
import type { Permission } from '../permissions.js';
import { email, isoDate, mobile, money, optionalIsoDate, optionalText, yearMonth } from './common.js';

export const salaryStructure = z.object({
  basic: money.default(0),
  allowances: money.default(0),
  deductions: money.default(0),
  payCycle: z.enum(PAY_CYCLES).default('Monthly'),
});
export const bankDetails = z.object({
  accountName: optionalText,
  accountNo: optionalText,
  ifsc: optionalText,
  upi: optionalText,
});

export const staffInput = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    mobile,
    email,
    role: z.enum(ROLES),
    branchIds: z.array(z.string().min(1)).min(1, 'Select at least one branch'),
    defaultBranchId: z.string().min(1),
    designation: optionalText,
    qualification: optionalText,
    joiningDate: optionalIsoDate,
    biometricUserId: optionalText,
    photoUrl: optionalText,
    active: z.coerce.boolean().default(true),
    password: z.union([z.literal(''), z.undefined(), z.string().min(8, 'Min 8 characters')]).transform((v) => (v ? v : undefined)),
    salary: salaryStructure.default({ basic: 0, allowances: 0, deductions: 0, payCycle: 'Monthly' }),
    bankDetails: bankDetails.default({}),
  })
  .refine((v) => v.branchIds.includes(v.defaultBranchId), { message: 'Default branch must be one of the assigned branches', path: ['defaultBranchId'] });
export type StaffInput = z.infer<typeof staffInput>;
export const staffUpdate = staffInput.innerType().partial();

export interface Staff extends Omit<StaffInput, 'password' | 'salary'>, Timestamped {
  employeeCode: string;
  salary: z.infer<typeof salaryStructure> & { net: number };
  lastLoginAt?: string;
  branches?: { _id: string; code: string; name: string }[];
}

export interface AuthUser {
  _id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: (typeof ROLES)[number];
  permissions: Permission[];
  branchIds: string[];
  defaultBranchId: string;
  branches: { _id: string; code: string; name: string }[];
  photoUrl?: string;
}

export const salaryPaymentInput = z.object({
  month: yearMonth,
  amount: money.refine((v) => v > 0, 'Amount must be positive'),
  paidOn: isoDate,
  mode: z.enum(PAYMENT_MODES),
  reference: optionalText,
  notes: optionalText,
});
export type SalaryPaymentInput = z.infer<typeof salaryPaymentInput>;
export interface SalaryPayment extends SalaryPaymentInput, Timestamped { staffId: string; branchId: string; staffName?: string }
