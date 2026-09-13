import { Schema, model, type InferSchemaType } from 'mongoose';
import { VENDOR_CATEGORIES } from '@acuheal/types';

const vendorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: String,
    mobile: { type: String, required: true },
    email: String,
    gstin: String,
    address: String,
    category: { type: [String], enum: VENDOR_CATEGORIES, default: [] },
    notes: String,
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type VendorDoc = InferSchemaType<typeof vendorSchema> & { _id: Schema.Types.ObjectId };
export const Vendor = model('Vendor', vendorSchema);
