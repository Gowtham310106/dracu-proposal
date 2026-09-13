import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { listQuery, salaryPaymentInput, staffInput, staffUpdate, yearMonth } from '@acuheal/types';
import { User } from '../../models/User.js';
import { SalaryPayment } from '../../models/SalaryPayment.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { ok, created, paginate, rx } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { isoToDate } from '../../utils/dates.js';
import { liftAll } from '../../utils/populate.js';

export const usersRouter = Router();

const staffSelect = '-passwordHash';

/** Doctors for pickers: active doctors assigned to the scoped branch (or all). */
usersRouter.get('/doctors', async (req, res) => {
  const filter: Record<string, unknown> = { role: 'DOCTOR', active: true };
  if (req.branchId) filter.branchIds = req.branchId;
  ok(res, await User.find(filter).select('fullName designation branchIds defaultBranchId photoUrl').sort('fullName').lean());
});

/** Lightweight staff list for pickers (assignedTo, paidBy). */
usersRouter.get('/pick', async (req, res) => {
  const filter: Record<string, unknown> = { active: true };
  if (req.branchId) filter.branchIds = req.branchId;
  ok(res, await User.find(filter).select('fullName role').sort('fullName').lean());
});

const salaryListQuery = listQuery.extend({ month: yearMonth.optional(), staffId: z.string().optional() });
usersRouter.get('/salary-payments', requirePermission('salary:manage'), validate(salaryListQuery, 'query'), async (req, res) => {
  const q = query<typeof salaryListQuery>(req);
  const filter: Record<string, unknown> = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (q.month) filter.month = q.month;
  if (q.staffId) filter.staffId = q.staffId;
  const { items, meta } = await paginate(SalaryPayment, filter, { page: q.page, limit: q.limit, sort: '-paidOnAt', populate: { path: 'staffId', select: 'fullName employeeCode' } });
  ok(res, liftAll(items as Record<string, unknown>[], { staffId: 'staff' }), meta);
});

const staffListQuery = listQuery.extend({ role: z.string().optional(), active: z.string().optional() });
usersRouter.get('/', requirePermission('staff:read'), validate(staffListQuery, 'query'), async (req, res) => {
  const q = query<typeof staffListQuery>(req);
  const filter: Record<string, unknown> = {};
  if (req.branchId) filter.branchIds = req.branchId;
  if (q.role) filter.role = q.role;
  if (q.active === 'true') filter.active = true;
  if (q.active === 'false') filter.active = false;
  if (q.q) filter.$or = [{ fullName: rx(q.q) }, { mobile: rx(q.q) }, { email: rx(q.q) }, { employeeCode: rx(q.q) }];
  const { items, meta } = await paginate(User, filter, { page: q.page, limit: q.limit, sort: q.sort ?? 'fullName', select: staffSelect, populate: { path: 'branchIds', select: 'code name' } });
  ok(res, items.map((u) => ({ ...u, branches: u.branchIds, branchIds: (u.branchIds as { _id: unknown }[]).map((b) => String(b._id)) })), meta);
});

usersRouter.get('/:id', requirePermission('staff:read'), async (req, res) => {
  const user = await User.findById(req.params.id).select(staffSelect).populate('branchIds', 'code name').lean();
  if (!user) throw notFound('Staff not found');
  const salary = user.salary ?? { basic: 0, allowances: 0, deductions: 0, payCycle: 'Monthly' };
  ok(res, {
    ...user,
    branches: user.branchIds,
    branchIds: (user.branchIds as { _id: unknown }[]).map((b) => String(b._id)),
    salary: { ...salary, net: (salary.basic ?? 0) + (salary.allowances ?? 0) - (salary.deductions ?? 0) },
  });
});

usersRouter.post('/', requirePermission('staff:manage'), validate(staffInput), async (req, res) => {
  const input = body<typeof staffInput>(req);
  if (!input.password) throw badRequest('Password is required for a new staff account');
  const user = await User.create({
    ...input,
    employeeCode: await seq.employeeCode(),
    passwordHash: await bcrypt.hash(input.password, 10),
    joiningDate: input.joiningDate ? isoToDate(input.joiningDate) : undefined,
    createdBy: req.user!.id,
  });
  audit({ userId: req.user!.id, action: 'create', entity: 'User', entityId: String(user._id), summary: `Staff ${user.fullName} (${user.role}) created` });
  const { passwordHash: _p, ...rest } = user.toObject();
  created(res, rest);
});

usersRouter.patch('/:id', requirePermission('staff:manage'), validate(staffUpdate), async (req, res) => {
  const input = body<typeof staffUpdate>(req);
  const update: Record<string, unknown> = { ...input, updatedBy: req.user!.id };
  delete update.password;
  if (input.joiningDate) update.joiningDate = isoToDate(input.joiningDate);
  if (input.branchIds && input.defaultBranchId && !input.branchIds.includes(input.defaultBranchId)) throw badRequest('Default branch must be one of the assigned branches');
  if (input.password) {
    update.passwordHash = await bcrypt.hash(input.password, 10);
    update.$inc = { tokenVersion: 1 };
  }
  const { $inc, ...set } = update;
  const user = await User.findByIdAndUpdate(req.params.id, { $set: set, ...($inc ? { $inc } : {}) }, { new: true }).select(staffSelect).lean();
  if (!user) throw notFound('Staff not found');
  audit({ userId: req.user!.id, action: 'update', entity: 'User', entityId: String(user._id), summary: `Staff ${user.fullName} updated`, after: { ...input, password: input.password ? '***' : undefined } });
  ok(res, user);
});

usersRouter.post('/:id/active', requirePermission('staff:manage'), validate(z.object({ active: z.boolean() })), async (req, res) => {
  const { active } = body<z.ZodObject<{ active: z.ZodBoolean }>>(req);
  if (!active && req.params.id === req.user!.id) throw badRequest('You cannot deactivate yourself');
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { active, updatedBy: req.user!.id }, $inc: { tokenVersion: 1 } }, { new: true }).select(staffSelect).lean();
  if (!user) throw notFound('Staff not found');
  audit({ userId: req.user!.id, action: 'status', entity: 'User', entityId: String(user._id), summary: `Staff ${user.fullName} ${active ? 'activated' : 'deactivated'}` });
  ok(res, user);
});

usersRouter.get('/:id/salary-payments', requirePermission('salary:manage'), async (req, res) => {
  ok(res, await SalaryPayment.find({ staffId: req.params.id }).sort('-paidOnAt').lean());
});

usersRouter.post('/:id/salary-payments', requirePermission('salary:manage'), validate(salaryPaymentInput), async (req, res) => {
  const input = body<typeof salaryPaymentInput>(req);
  const staff = await User.findById(req.params.id).select('fullName defaultBranchId').lean();
  if (!staff) throw notFound('Staff not found');
  const payment = await SalaryPayment.create({ ...input, staffId: staff._id, branchId: staff.defaultBranchId, paidOnAt: isoToDate(input.paidOn), createdBy: req.user!.id });
  audit({ userId: req.user!.id, action: 'payment', entity: 'SalaryPayment', entityId: String(payment._id), branchId: String(staff.defaultBranchId), summary: `Salary ₹${input.amount} paid to ${staff.fullName} for ${input.month}` });
  created(res, payment.toObject());
});
