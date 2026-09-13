import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const optionalObjectId = objectId.optional().or(z.literal('').transform(() => undefined));

/** Indian mobile: accepts +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX or XXXXXXXXXX and stores the 10 digits. */
export const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, '').replace(/^\+?91/, '').replace(/^0/, ''))
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number');
export const optionalMobile = z.union([z.literal(''), z.undefined(), z.null(), mobile]).transform((v) => (v ? v : undefined));

export const email = z.string().trim().email();
export const optionalEmail = z.union([z.literal(''), z.undefined(), z.null(), email]).transform((v) => (v ? v : undefined));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const optionalIsoDate = z.union([z.literal(''), z.undefined(), z.null(), isoDate]).transform((v) => (v ? v : undefined));
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
export const optionalHhmm = z.union([z.literal(''), z.undefined(), z.null(), hhmm]).transform((v) => (v ? v : undefined));
export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));
export const optionalIsoDateTime = z.union([z.literal(''), z.undefined(), z.null(), isoDateTime]).transform((v) => (v ? v : undefined));

export const money = z.coerce.number().min(0).max(1e9);
export const optionalMoney = z.union([z.literal(''), z.undefined(), z.null(), money]).transform((v) => (v === '' || v == null ? undefined : v));
export const optionalNumber = z.union([z.literal(''), z.undefined(), z.null(), z.coerce.number()]).transform((v) => (v === '' || v == null ? undefined : v));

export const optionalText = z.union([z.literal(''), z.undefined(), z.null(), z.string().trim()]).transform((v) => (v ? v : undefined));
export const pincode = z.union([z.literal(''), z.undefined(), z.null(), z.string().regex(/^\d{6}$/, '6-digit PIN')]).transform((v) => (v ? v : undefined));

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().optional(),
  sort: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  branchId: z.string().optional(),
  status: z.string().optional(),
});
export type ListQueryInput = z.infer<typeof listQuery>;

export const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);
export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(''), z.undefined(), z.null(), z.enum(values)]).transform((v) => (v ? v : undefined));
