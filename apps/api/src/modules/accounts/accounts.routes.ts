import { Router } from 'express';
import { z } from 'zod';
import { dateRangeQuery, expenseInput, listQuery, purchaseInput, vendorInput } from '@acuheal/types';
import { Expense } from '../../models/Expense.js';
import { Vendor } from '../../models/Vendor.js';
import { Purchase } from '../../models/Purchase.js';
import { Payment } from '../../models/Payment.js';
import { Invoice } from '../../models/Invoice.js';
import { SalaryPayment } from '../../models/SalaryPayment.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { notFound } from '../../middleware/error.js';
import { ok, created, paginate, rx } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { isoToDate, todayIso } from '../../utils/dates.js';
import { liftAll } from '../../utils/populate.js';

export const accountsRouter = Router();

const dateFilter = (from?: string, to?: string) => (from || to ? { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {});

/* ---------- Expenses ---------- */

const expListQuery = listQuery.extend({ category: z.string().optional(), vendorId: z.string().optional() });
accountsRouter.get('/expenses', requirePermission('accounts:read'), validate(expListQuery, 'query'), async (req, res) => {
  const q = query<typeof expListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req), ...dateFilter(q.from, q.to) };
  if (q.category) filter.category = q.category;
  if (q.vendorId) filter.vendorId = q.vendorId;
  if (q.q) filter.$or = [{ description: rx(q.q) }, { billNo: rx(q.q) }];
  const { items, meta } = await paginate(Expense, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-dateAt -createdAt', populate: [{ path: 'vendorId', select: 'name' }, { path: 'paidBy', select: 'fullName' }, { path: 'branchId', select: 'code name' }] });
  ok(res, liftAll(items as Record<string, unknown>[], { vendorId: 'vendor', paidBy: 'payer', branchId: 'branch' }), meta);
});

accountsRouter.post('/expenses', requirePermission('accounts:write'), validate(expenseInput), async (req, res) => {
  const input = body<typeof expenseInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const expense = await Expense.create({ ...input, branchId, dateAt: isoToDate(input.date), createdBy: req.user!.id });
  audit({ userId: req.user!.id, action: 'create', entity: 'Expense', entityId: String(expense._id), branchId, summary: `Expense ₹${input.amount} (${input.category}) ${input.description}` });
  created(res, expense.toObject());
});

accountsRouter.patch('/expenses/:id', requirePermission('accounts:write'), validate(expenseInput.partial()), async (req, res) => {
  const input = body<z.ZodObject<z.ZodRawShape>>(req) as Partial<z.infer<typeof expenseInput>>;
  const set: Record<string, unknown> = { ...input, updatedBy: req.user!.id };
  delete set.branchId;
  if (input.date) set.dateAt = isoToDate(input.date);
  const expense = await Expense.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
  if (!expense) throw notFound('Expense not found');
  audit({ userId: req.user!.id, action: 'update', entity: 'Expense', entityId: String(expense._id), branchId: String(expense.branchId), summary: `Expense updated`, after: input });
  ok(res, expense);
});

accountsRouter.delete('/expenses/:id', requirePermission('accounts:write'), async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id).lean();
  if (!expense) throw notFound('Expense not found');
  audit({ userId: req.user!.id, action: 'delete', entity: 'Expense', entityId: String(expense._id), branchId: String(expense.branchId), summary: `Expense ₹${expense.amount} deleted`, before: expense });
  ok(res, { deleted: true });
});

/* ---------- Vendors ---------- */

accountsRouter.get('/vendors', requirePermission('accounts:read'), validate(listQuery, 'query'), async (req, res) => {
  const q = query<typeof listQuery>(req);
  const filter: Record<string, unknown> = {};
  if (q.status === 'active') filter.active = true;
  if (q.q) filter.$or = [{ name: rx(q.q) }, { mobile: rx(q.q) }, { contactPerson: rx(q.q) }];
  const { items, meta } = await paginate(Vendor, filter, { page: q.page, limit: q.limit, sort: q.sort ?? 'name' });
  const ids = items.map((v) => v._id);
  const totals = await Purchase.aggregate<{ _id: unknown; total: number; paid: number }>([{ $match: { vendorId: { $in: ids } } }, { $group: { _id: '$vendorId', total: { $sum: '$total' }, paid: { $sum: '$paidAmount' } } }]);
  const byVendor = new Map(totals.map((t) => [String(t._id), t]));
  ok(res, items.map((v) => ({ ...v, totalPurchased: byVendor.get(String(v._id))?.total ?? 0, totalOutstanding: (byVendor.get(String(v._id))?.total ?? 0) - (byVendor.get(String(v._id))?.paid ?? 0) })), meta);
});

accountsRouter.get('/vendors/:id', requirePermission('accounts:read'), async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).lean();
  if (!vendor) throw notFound('Vendor not found');
  const purchases = await Purchase.find({ vendorId: vendor._id }).sort('-dateAt').limit(100).lean();
  ok(res, { ...vendor, purchases });
});

accountsRouter.post('/vendors', requirePermission('vendors:manage'), validate(vendorInput), async (req, res) => {
  const vendor = await Vendor.create({ ...body<typeof vendorInput>(req), createdBy: req.user!.id });
  created(res, vendor.toObject());
});

accountsRouter.patch('/vendors/:id', requirePermission('vendors:manage'), validate(vendorInput.partial()), async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, { $set: { ...body<z.ZodObject<z.ZodRawShape>>(req), updatedBy: req.user!.id } }, { new: true }).lean();
  if (!vendor) throw notFound('Vendor not found');
  ok(res, vendor);
});

/* ---------- Purchases ---------- */

const purListQuery = listQuery.extend({ vendorId: z.string().optional(), paymentStatus: z.string().optional() });
accountsRouter.get('/purchases', requirePermission('accounts:read'), validate(purListQuery, 'query'), async (req, res) => {
  const q = query<typeof purListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req), ...dateFilter(q.from, q.to) };
  if (q.vendorId) filter.vendorId = q.vendorId;
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
  if (q.q) filter.$or = [{ purchaseNo: rx(q.q) }, { billNo: rx(q.q) }, { 'items.name': rx(q.q) }];
  const { items, meta } = await paginate(Purchase, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-dateAt', populate: [{ path: 'vendorId', select: 'name' }, { path: 'branchId', select: 'code name' }] });
  ok(res, liftAll(items as Record<string, unknown>[], { vendorId: 'vendor', branchId: 'branch' }), meta);
});

accountsRouter.post('/purchases', requirePermission('vendors:manage'), validate(purchaseInput), async (req, res) => {
  const input = body<typeof purchaseInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const items = input.items.map((i) => ({ ...i, amount: Math.round(i.qty * i.unitPrice) }));
  const total = items.reduce((s, i) => s + i.amount, 0);
  const paymentStatus = input.paidAmount >= total ? 'Paid' : input.paidAmount > 0 ? 'Partial' : 'Unpaid';
  const purchase = await Purchase.create({ ...input, branchId, items, total, paymentStatus, purchaseNo: await seq.purchaseNo(), dateAt: isoToDate(input.date), createdBy: req.user!.id });
  audit({ userId: req.user!.id, action: 'create', entity: 'Purchase', entityId: String(purchase._id), branchId, summary: `Purchase ${purchase.purchaseNo} ₹${total}` });
  created(res, purchase.toObject());
});

accountsRouter.patch('/purchases/:id', requirePermission('vendors:manage'), validate(purchaseInput.partial()), async (req, res) => {
  const input = body<z.ZodObject<z.ZodRawShape>>(req) as Partial<z.infer<typeof purchaseInput>>;
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw notFound('Purchase not found');
  if (input.items) {
    purchase.items = input.items.map((i) => ({ ...i, amount: Math.round(i.qty * i.unitPrice) })) as never;
    purchase.total = purchase.items.reduce((s, i) => s + i.amount, 0);
  }
  if (input.paidAmount !== undefined) purchase.paidAmount = input.paidAmount;
  if (input.date) {
    purchase.date = input.date;
    purchase.dateAt = isoToDate(input.date);
  }
  if (input.billNo !== undefined) purchase.billNo = input.billNo;
  if (input.dueDate !== undefined) purchase.dueDate = input.dueDate;
  if (input.attachmentUrl !== undefined) purchase.attachmentUrl = input.attachmentUrl;
  purchase.paymentStatus = purchase.paidAmount >= purchase.total ? 'Paid' : purchase.paidAmount > 0 ? 'Partial' : 'Unpaid';
  purchase.updatedBy = req.user!.id as never;
  await purchase.save();
  ok(res, purchase.toObject());
});

/* ---------- Summary & export ---------- */

accountsRouter.get('/summary', requirePermission('accounts:read'), validate(dateRangeQuery, 'query'), async (req, res) => {
  const q = query<typeof dateRangeQuery>(req);
  const from = q.from ?? todayIso();
  const to = q.to ?? todayIso();
  const scope = { ...branchFilter(req), ...dateFilter(from, to) };
  const [collections, byMode, sales, expenses, byCategory, purchases, salaries, dues] = await Promise.all([
    Payment.aggregate<{ total: number; count: number }>([{ $match: scope }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate<{ _id: string; total: number }>([{ $match: scope }, { $group: { _id: '$mode', total: { $sum: '$amount' } } }]),
    Invoice.aggregate<{ total: number; count: number }>([{ $match: scope }, { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }]),
    Expense.aggregate<{ total: number; count: number }>([{ $match: scope }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Expense.aggregate<{ _id: string; total: number }>([{ $match: scope }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
    Purchase.aggregate<{ total: number; paid: number }>([{ $match: scope }, { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' } } }]),
    SalaryPayment.aggregate<{ total: number }>([{ $match: { ...branchFilter(req), paidOn: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Invoice.aggregate<{ total: number }>([{ $match: { ...branchFilter(req), paymentStatus: { $in: ['Unpaid', 'Partial'] } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
  ]);
  const income = collections[0]?.total ?? 0;
  const expenseTotal = (expenses[0]?.total ?? 0) + (purchases[0]?.paid ?? 0) + (salaries[0]?.total ?? 0);
  ok(res, {
    from,
    to,
    sales: sales[0]?.total ?? 0,
    invoiceCount: sales[0]?.count ?? 0,
    collections: income,
    paymentCount: collections[0]?.count ?? 0,
    byMode: Object.fromEntries(byMode.map((m) => [m._id, m.total])),
    expenses: expenses[0]?.total ?? 0,
    expenseCount: expenses[0]?.count ?? 0,
    byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
    purchasesPaid: purchases[0]?.paid ?? 0,
    purchasesTotal: purchases[0]?.total ?? 0,
    salaries: salaries[0]?.total ?? 0,
    outstandingDues: dues[0]?.total ?? 0,
    net: income - expenseTotal,
  });
});

const exportQuery = dateRangeQuery.extend({ type: z.enum(['payments', 'expenses', 'invoices']) });
accountsRouter.get('/export.csv', requirePermission('accounts:read'), validate(exportQuery, 'query'), async (req, res) => {
  const q = query<typeof exportQuery>(req);
  const scope = { ...branchFilter(req), ...dateFilter(q.from, q.to) };
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let rows: string[][] = [];
  if (q.type === 'payments') {
    const items = await Payment.find(scope).populate('patientId', 'pid fullName').sort('dateAt').lean();
    rows = [['Date', 'Receipt', 'Patient', 'PID', 'Amount', 'Mode', 'Reference'], ...items.map((p) => [p.date, p.receiptNo, (p.patientId as { fullName?: string })?.fullName ?? '', (p.patientId as { pid?: string })?.pid ?? '', String(p.amount), p.mode, p.reference ?? ''])];
  } else if (q.type === 'expenses') {
    const items = await Expense.find(scope).sort('dateAt').lean();
    rows = [['Date', 'Category', 'Description', 'Amount', 'Mode', 'Bill no'], ...items.map((e) => [e.date, e.category, e.description, String(e.amount), e.mode, e.billNo ?? ''])];
  } else {
    const items = await Invoice.find(scope).populate('patientId', 'pid fullName').sort('dateAt').lean();
    rows = [['Date', 'Invoice', 'Patient', 'PID', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status'], ...items.map((i) => [i.date, i.invoiceNo, (i.patientId as { fullName?: string })?.fullName ?? '', (i.patientId as { pid?: string })?.pid ?? '', String(i.subtotal), String(i.discount), String(i.taxAmount), String(i.grandTotal), String(i.amountPaid), String(i.balance), i.paymentStatus])];
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${q.type}-${q.from ?? 'all'}-${q.to ?? 'all'}.csv"`);
  res.send(rows.map((r) => r.map(esc).join(',')).join('\r\n'));
});
