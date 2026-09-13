import type { Permission, Role } from '@acuheal/types';

export interface AuthContext {
  id: string;
  role: Role;
  permissions: Permission[];
  branchIds: string[];
  defaultBranchId: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthContext;
      /** Effective branch scope: an id, or undefined meaning "all branches" (only for branches:all users). */
      branchId?: string;
      validated: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
