import { Invoice } from '../../models/Invoice.js';
import { Payment } from '../../models/Payment.js';
import { TreatmentPackage } from '../../models/TreatmentPackage.js';
import { Branch } from '../../models/Branch.js';
import { badRequest, notFound } from '../../middleware/error.js';
import { seq } from '../../utils/sequence.js';
import { isoToDate } from '../../utils/dates.js';
import { audit } from '../../utils/audit.js';

/** Recompute amountPaid / balance / status of an invoice from its payments. */
export async function recomputeInvoice(invoiceId: string) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found');
  const [agg] = await Payment.aggregate<{ paid: number }>([{ $match: { invoiceId: invoice._id } }, { $group: { _id: null, paid: { $sum: '$amount' } } }]);
  const paid = agg?.paid ?? 0;
  invoice.amountPaid = paid;
  invoice.balance = Math.max(0, invoice.grandTotal - paid);
  invoice.paymentStatus = paid <= 0 ? 'Unpaid' : paid >= invoice.grandTotal ? 'Paid' : 'Partial';
  await invoice.save();
  return invoice.toObject();
}

/** Recompute totalPaid / balance of a package from its payments. */
export async function recomputePackage(packageId: string) {
  const pkg = await TreatmentPackage.findById(packageId);
  if (!pkg) throw notFound('Package not found');
  const [agg] = await Payment.aggregate<{ paid: number }>([{ $match: { packageId: pkg._id } }, { $group: { _id: null, paid: { $sum: '$amount' } } }]);
  pkg.totalPaid = agg?.paid ?? 0;
  pkg.balance = Math.max(0, pkg.totalPayable - pkg.totalPaid);
  await pkg.save();
  return pkg.toObject();
}

export interface RecordPaymentParams {
  invoiceId?: string;
  packageId?: string;
  patientId?: string;
  branchId?: string;
  amount: number;
  mode: string;
  date: string;
  reference?: string;
  remarks?: string;
  userId: string;
}

/** Records a payment against an invoice and/or a package, then recomputes balances. */
export async function recordPayment(p: RecordPaymentParams) {
  let branchId = p.branchId;
  let patientId = p.patientId;
  let packageId = p.packageId;

  if (p.invoiceId) {
    const inv = await Invoice.findById(p.invoiceId).select('branchId patientId packageId balance').lean();
    if (!inv) throw notFound('Invoice not found');
    if (p.amount > inv.balance) throw badRequest(`Amount exceeds invoice balance ₹${inv.balance}`);
    branchId = String(inv.branchId);
    patientId = String(inv.patientId);
    packageId = packageId ?? (inv.packageId ? String(inv.packageId) : undefined);
  } else if (packageId) {
    const pkg = await TreatmentPackage.findById(packageId).select('branchId patientId balance').lean();
    if (!pkg) throw notFound('Package not found');
    if (p.amount > pkg.balance) throw badRequest(`Amount exceeds package balance ₹${pkg.balance}`);
    branchId = String(pkg.branchId);
    patientId = String(pkg.patientId);
  }
  if (!branchId || !patientId) throw badRequest('Payment must be against an invoice or a package');

  const branch = await Branch.findById(branchId).select('code').lean();
  if (!branch) throw notFound('Branch not found');
  const dateAt = isoToDate(p.date);
  const payment = await Payment.create({
    receiptNo: await seq.receiptNo(branchId, branch.code, dateAt),
    branchId,
    patientId,
    invoiceId: p.invoiceId,
    packageId,
    amount: p.amount,
    mode: p.mode,
    date: p.date,
    dateAt,
    reference: p.reference,
    remarks: p.remarks,
    receivedBy: p.userId,
    createdBy: p.userId,
  });
  if (p.invoiceId) await recomputeInvoice(p.invoiceId);
  if (packageId) await recomputePackage(packageId);
  audit({ userId: p.userId, action: 'payment', entity: 'Payment', entityId: String(payment._id), branchId, summary: `₹${p.amount} received (${p.mode}) receipt ${payment.receiptNo}` });
  return payment.toObject();
}
