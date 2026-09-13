import type { Role } from './enums.js';

export const PERMISSIONS = [
  'dashboard:view',
  'patients:read', 'patients:write',
  'appointments:read', 'appointments:write',
  'clinical:write',
  'packages:read', 'packages:write',
  'billing:read', 'billing:write', 'payments:write',
  'crm:read', 'crm:write',
  'messaging:read', 'messaging:manage',
  'attendance:read', 'attendance:manage',
  'accounts:read', 'accounts:write',
  'vendors:manage',
  'staff:read', 'staff:manage', 'salary:manage',
  'media:read', 'media:write',
  'reports:view',
  'audit:read',
  'admin:manage',
  'branches:all',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  DOCTOR: [
    'dashboard:view', 'patients:read', 'patients:write', 'appointments:read', 'appointments:write',
    'clinical:write', 'packages:read', 'packages:write', 'billing:read', 'crm:read',
    'media:read', 'media:write', 'reports:view', 'attendance:read', 'messaging:read', 'branches:all',
  ],
  FRONT_DESK: [
    'dashboard:view', 'patients:read', 'patients:write', 'appointments:read', 'appointments:write',
    'packages:read', 'packages:write', 'billing:read', 'billing:write', 'payments:write',
    'crm:read', 'crm:write', 'messaging:read', 'media:read', 'media:write', 'attendance:read',
  ],
  ACCOUNTS: [
    'dashboard:view', 'patients:read', 'billing:read', 'billing:write', 'payments:write',
    'accounts:read', 'accounts:write', 'vendors:manage', 'salary:manage', 'staff:read',
    'attendance:read', 'reports:view', 'media:read', 'branches:all',
  ],
};

export function hasPermission(perms: readonly string[] | undefined, needed: Permission | Permission[]): boolean {
  if (!perms) return false;
  const list = Array.isArray(needed) ? needed : [needed];
  return list.every((p) => perms.includes(p));
}
