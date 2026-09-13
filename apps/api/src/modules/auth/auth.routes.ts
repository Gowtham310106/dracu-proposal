import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { changePasswordInput, loginInput, ROLE_PERMISSIONS, type AuthUser, type Role } from '@acuheal/types';
import { env } from '../../config/env.js';
import { User } from '../../models/User.js';
import { Branch } from '../../models/Branch.js';
import { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../middleware/auth.js';
import { validate, body } from '../../middleware/validate.js';
import { badRequest, unauthorized } from '../../middleware/error.js';
import { ok } from '../../utils/http.js';
import { audit } from '../../utils/audit.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'acuheal_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SECURE ? ('none' as const) : ('lax' as const),
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 3600 * 1000,
};

export async function buildAuthUser(userId: string): Promise<AuthUser> {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthorized();
  const branches = await Branch.find({ _id: { $in: user.branchIds }, active: true }).select('code name').sort('name').lean();
  return {
    _id: String(user._id),
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    permissions: ROLE_PERMISSIONS[user.role as Role] ?? [],
    branchIds: user.branchIds.map(String),
    defaultBranchId: String(user.defaultBranchId),
    branches: branches.map((b) => ({ _id: String(b._id), code: b.code, name: b.name })),
    photoUrl: user.photoUrl ?? undefined,
  };
}

const ACCESS_TTL_SECONDS = 15 * 60;

authRouter.post('/login', validate(loginInput), async (req, res) => {
  const { email, password } = body<typeof loginInput>(req);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash active tokenVersion role').lean();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Invalid email or password');
  if (!user.active) throw unauthorized('Account is disabled. Contact the administrator.');
  const payload = { sub: String(user._id), role: user.role as Role, v: user.tokenVersion ?? 0 };
  res.cookie(REFRESH_COOKIE, signRefreshToken(payload), cookieOpts);
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  audit({ userId: String(user._id), action: 'login', entity: 'User', entityId: String(user._id), summary: `${email} logged in`, ip: req.ip });
  ok(res, { accessToken: signAccessToken(payload), expiresIn: ACCESS_TTL_SECONDS, user: await buildAuthUser(String(user._id)) });
});

authRouter.post('/refresh', async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
  if (!token) throw unauthorized('No session');
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Session expired');
  }
  const user = await User.findById(payload.sub).select('active tokenVersion role').lean();
  if (!user || !user.active || (user.tokenVersion ?? 0) !== payload.v) {
    res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
    throw unauthorized('Session expired');
  }
  const fresh = { sub: String(user._id), role: user.role as Role, v: user.tokenVersion ?? 0 };
  res.cookie(REFRESH_COOKIE, signRefreshToken(fresh), cookieOpts);
  ok(res, { accessToken: signAccessToken(fresh), expiresIn: ACCESS_TTL_SECONDS, user: await buildAuthUser(String(user._id)) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
  ok(res, { loggedOut: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  ok(res, await buildAuthUser(req.user!.id));
});

authRouter.post('/change-password', requireAuth, validate(changePasswordInput), async (req, res) => {
  const { currentPassword, newPassword } = body<typeof changePasswordInput>(req);
  const user = await User.findById(req.user!.id).select('+passwordHash tokenVersion');
  if (!user) throw unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
  ok(res, { changed: true });
});
