/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express';
import type { FilterQuery, Model, PopulateOptions } from 'mongoose';
import type { PageMeta } from '@acuheal/types';

export function ok<T>(res: Response, data: T, meta?: PageMeta, status = 200): void {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, undefined, 201);
}

export interface PaginateOptions {
  page: number;
  limit: number;
  sort?: string; // e.g. "-createdAt" or "fullName"
  populate?: PopulateOptions | (PopulateOptions | string)[] | string;
  select?: string;
}

export type LeanDoc = Record<string, any> & { _id: any };

export async function paginate<T extends LeanDoc = LeanDoc>(model: Model<any>, filter: FilterQuery<any>, opts: PaginateOptions): Promise<{ items: T[]; meta: PageMeta }> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(200, Math.max(1, opts.limit));
  let q = model.find(filter).sort(opts.sort ?? '-createdAt').skip((page - 1) * limit).limit(limit);
  if (opts.select) q = q.select(opts.select);
  if (opts.populate) q = q.populate(opts.populate as any);
  const [items, total] = await Promise.all([q.lean<T[]>(), model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Sum one numeric field over a filter. */
export async function sumField(model: Model<any>, match: Record<string, unknown>, field: string): Promise<{ total: number; count: number }> {
  const rows = await model.aggregate<{ total: number; count: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } }]);
  return { total: rows[0]?.total ?? 0, count: rows[0]?.count ?? 0 };
}

/** Case-insensitive regex that escapes user input. */
export function rx(input: string): RegExp {
  return new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
