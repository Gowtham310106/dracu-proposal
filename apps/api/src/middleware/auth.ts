import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ROLE_PERMISSIONS, type Permission, type Role } from '@acuheal/types';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from './error.js';
import { User } from '../models/User.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  v: number; // token version, bumped on password change / deactivation
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] });
}
export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'] });
}
export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AccessTokenPayload;
}

/** Requires a valid bearer token and loads a lightweight user context (cached per request). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw unauthorized('Missing bearer token');
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    } catch {
      throw unauthorized('Invalid or expired token');
    }
    const user = await User.findById(payload.sub).select('role active tokenVersion branchIds defaultBranchId fullName').lean();
    if (!user || !user.active) throw unauthorized('Account disabled');
    if ((user.tokenVersion ?? 0) !== payload.v) throw unauthorized('Session expired, please log in again');
    req.user = {
      id: String(user._id),
      role: user.role as Role,
      permissions: ROLE_PERMISSIONS[user.role as Role] ?? [],
      branchIds: (user.branchIds ?? []).map(String),
      defaultBranchId: String(user.defaultBranchId),
      fullName: user.fullName,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export function requirePermission(...needed: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const ok = needed.every((p) => req.user!.permissions.includes(p));
    if (!ok) return next(forbidden(`Missing permission: ${needed.join(', ')}`));
    next();
  };
}

/** Shared-secret guard for machine integrations (biometric bridge, external cron). */
export function requireApiKey(getKey: () => string, header = 'x-api-key'): RequestHandler {
  return (req, _res, next) => {
    const provided = req.headers[header];
    const expected = getKey();
    if (!expected || provided !== expected) return next(unauthorized('Invalid API key'));
    next();
  };
}
