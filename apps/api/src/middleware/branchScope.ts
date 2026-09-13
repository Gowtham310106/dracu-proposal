import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { forbidden } from './error.js';

/**
 * Resolves the branch scope for the request from the `x-branch-id` header.
 *  - users with `branches:all` may pass any branch id, or `all` (=> req.branchId undefined)
 *  - other users are locked to their defaultBranchId regardless of header
 */
export const branchScope: RequestHandler = (req, _res, next) => {
  const user = req.user;
  if (!user) return next();
  const header = (req.headers['x-branch-id'] as string | undefined)?.trim();
  const canSwitch = user.permissions.includes('branches:all');
  if (!canSwitch) {
    req.branchId = user.defaultBranchId;
    return next();
  }
  if (!header || header === 'all') {
    req.branchId = user.role === 'ADMIN' || user.role === 'ACCOUNTS' ? undefined : user.defaultBranchId;
    return next();
  }
  if (user.role !== 'ADMIN' && !user.branchIds.includes(header)) return next(forbidden('You are not assigned to this branch'));
  req.branchId = header;
  next();
};

/**
 * Mongo filter fragment for the current branch scope.
 * The id is cast to an ObjectId here because aggregation `$match` stages do not cast strings
 * the way `find()` does — a raw string would silently match nothing in every report.
 */
export function branchFilter(req: { branchId?: string }, field = 'branchId'): Record<string, unknown> {
  if (!req.branchId || !Types.ObjectId.isValid(req.branchId)) return {};
  return { [field]: new Types.ObjectId(req.branchId) };
}

/** Resolves the branch to write a new record into: explicit body branch (if allowed) else the scoped branch. */
export function resolveWriteBranch(req: { branchId?: string; user?: { permissions: string[]; branchIds: string[]; defaultBranchId: string; role: string } }, requested?: string): string {
  const user = req.user!;
  if (requested) {
    if (user.role === 'ADMIN' || user.branchIds.includes(requested)) return requested;
    throw forbidden('You are not assigned to this branch');
  }
  return req.branchId ?? user.defaultBranchId;
}
