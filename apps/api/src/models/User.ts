import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAY_CYCLES, ROLES } from '@acuheal/types';

const userSchema = new Schema(
  {
    employeeCode: { type: String, required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, enum: ROLES, required: true, index: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch', required: true }],
    defaultBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    designation: String,
    qualification: String,
    joiningDate: Date,
    biometricUserId: { type: String, index: true, sparse: true },
    photoUrl: String,
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
    salary: {
      basic: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      payCycle: { type: String, enum: PAY_CYCLES, default: 'Monthly' },
    },
    bankDetails: {
      accountName: String,
      accountNo: String,
      ifsc: String,
      upi: String,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

userSchema.virtual('salary.net').get(function (this: { salary?: { basic?: number; allowances?: number; deductions?: number } }) {
  const s = this.salary ?? {};
  return (s.basic ?? 0) + (s.allowances ?? 0) - (s.deductions ?? 0);
});

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const User = model('User', userSchema);
