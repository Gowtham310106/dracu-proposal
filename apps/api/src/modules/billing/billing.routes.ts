import { Router } from 'express';
import { z } from 'zod';
import { computeInvoiceTotals, invoiceInput, listQuery, paymentInput } from '@acuheal/types';
import { Invoice } from '../../models/Invoice.js';
import { Payment } from '../../models/Payment.js';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { TreatmentPackage } from '../../models/TreatmentPackage.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter, resolveWriteBranch } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { ok, created, paginate, rx } from '../../utils/http.js';
import { seq } from '../../utils/sequence.js';
import { audit } from '../../utils/audit.js';
import { isoToDate } from '../../utils/dates.js';
import { liftAll, liftRefs } from '../../utils/populate.js';
import { recordPayment } from './billing.service.js';

export const billingRouter = Router();

const INV_POPULATE = [
  { path: 'patientId', select: 'pid fullName mobile addressLine area city pincode' },
  { path: 'branchId', select: 'code name address city state phone gstin whatsappNumber' },
  { path: 'packageId', select: 'packageNo totalSessions sessionsCompleted balance treatmentPlanName customPlanName' },
];
const INV_LIFT = { patientId: 'patient', branchId: 'branch', packageId: 'package' };

const invListQuery = listQuery.extend({ patientId: z.string().optional(), paymentStatus: z.string().optional() });
billingRouter.get('/invoices', requirePermission('billing:read'), validate(invListQuery, 'query'), async (req, res) => {
  const q = query<typeof invListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.patientId) filter.patientId = q.patientId;
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
  if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.q) {
    const patients = await Patient.find({ $or: [{ fullName: rx(q.q) }, { pid: rx(q.q) }, { mobile: rx(q.q) }] }).select('_id').limit(50).lean();
    filter.$or = [{ invoiceNo: rx(q.q) }, { patientId: { $in: patients.map((p) => p._id) } }];
  }
  const { items, meta } = await paginate(Invoice, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-dateAt -createdAt', populate: INV_POPULATE });
  ok(res, liftAll(items as Record<string, unknown>[], INV_LIFT), meta);
});

billingRouter.get('/invoices/:id', requirePermission('billing:read'), async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate(INV_POPULATE).lean();
  if (!invoice) throw notFound('Invoice not found');
  const payments = await Payment.find({ invoiceId: invoice._id }).populate('receivedBy', 'fullName').sort('dateAt').lean();
  ok(res, { ...liftRefs(invoice as Record<string, unknown>, INV_LIFT), payments: liftAll(payments as Record<string, unknown>[], { receivedBy: 'receiver' }) });
});

billingRouter.post('/invoices', requirePermission('billing:write'), validate(invoiceInput), async (req, res) => {
  const input = body<typeof invoiceInput>(req);
  const branchId = resolveWriteBranch(req, input.branchId);
  const [patient, branch] = await Promise.all([Patient.findById(input.patientId).select('fullName').lean(), Branch.findById(branchId).select('code').lean()]);
  if (!patient) throw notFound('Patient not found');
  if (!branch) throw notFound('Branch not found');
  if (input.packageId) {
    const pkg = await TreatmentPackage.findById(input.packageId).select('patientId').lean();
    if (!pkg || String(pkg.patientId) !== input.patientId) throw badRequest('Package does not belong to this patient');
  }
  const items = input.items.map((i) => ({ ...i, amount: Math.round(i.qty * i.unitPrice) }));
  const totals = computeInvoiceTotals({ items, discount: input.discount, taxPercent: input.taxPercent });
  if (input.payment && input.payment.amount > totals.grandTotal) throw badRequest('Payment exceeds invoice total');
  const dateAt = isoToDate(input.date);
  const invoice = await Invoice.create({
    invoiceNo: await seq.invoiceNo(branchId, branch.code, dateAt),
    branchId,
    patientId: input.patientId,
    packageId: input.packageId,
    date: input.date,
    dateAt,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxPercent: input.taxPercent,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    balance: totals.grandTotal,
    paymentStatus: 'Unpaid',
    notes: input.notes,
    createdBy: req.user!.id,
  });
  audit({ userId: req.user!.id, action: 'create', entity: 'Invoice', entityId: String(invoice._id), branchId, summary: `Invoice ${invoice.invoiceNo} ₹${totals.grandTotal} for ${patient.fullName}` });
  if (input.payment && input.payment.amount > 0) {
    await recordPayment({ invoiceId: String(invoice._id), amount: input.payment.amount, mode: input.payment.mode, date: input.date, reference: input.payment.reference, remarks: input.payment.remarks, userId: req.user!.id });
  }
  const full = await Invoice.findById(invoice._id).populate(INV_POPULATE).lean();
  const payments = await Payment.find({ invoiceId: invoice._id }).lean();
  created(res, { ...liftRefs(full as Record<string, unknown>, INV_LIFT), payments });
});

billingRouter.post('/invoices/:id/printed', requirePermission('billing:read'), async (req, res) => {
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { $inc: { printedCount: 1 } }, { new: true }).select('printedCount invoiceNo branchId').lean();
  if (!invoice) throw notFound('Invoice not found');
  audit({ userId: req.user!.id, action: 'print', entity: 'Invoice', entityId: String(invoice._id), branchId: String(invoice.branchId), summary: `Invoice ${invoice.invoiceNo} printed` });
  ok(res, { printedCount: invoice.printedCount });
});

const payListQuery = listQuery.extend({ patientId: z.string().optional(), mode: z.string().optional(), packageId: z.string().optional() });
billingRouter.get('/payments', requirePermission('billing:read'), validate(payListQuery, 'query'), async (req, res) => {
  const q = query<typeof payListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req) };
  if (q.patientId) filter.patientId = q.patientId;
  if (q.packageId) filter.packageId = q.packageId;
  if (q.mode) filter.mode = q.mode;
  if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const { items, meta } = await paginate(Payment, filter, {
    page: q.page,
    limit: q.limit,
    sort: q.sort ?? '-dateAt -createdAt',
    populate: [
      { path: 'patientId', select: 'pid fullName mobile' },
      { path: 'invoiceId', select: 'invoiceNo' },
      { path: 'packageId', select: 'packageNo' },
      { path: 'receivedBy', select: 'fullName' },
    ],
  });
  ok(res, liftAll(items as Record<string, unknown>[], { patientId: 'patient', invoiceId: 'invoice', packageId: 'package', receivedBy: 'receiver' }), meta);
});

billingRouter.post('/payments', requirePermission('payments:write'), validate(paymentInput), async (req, res) => {
  const input = body<typeof paymentInput>(req);
  const payment = await recordPayment({ ...input, userId: req.user!.id });
  created(res, payment);
});
