import { Router } from 'express';
import { z } from 'zod';
import { dateRangeQuery } from '@acuheal/types';
import { Invoice } from '../../models/Invoice.js';
import { Payment } from '../../models/Payment.js';
import { Expense } from '../../models/Expense.js';
import { Appointment } from '../../models/Appointment.js';
import { Patient } from '../../models/Patient.js';
import { Lead } from '../../models/Lead.js';
import { SessionLog } from '../../models/SessionLog.js';
import { TreatmentPackage } from '../../models/TreatmentPackage.js';
import { Branch } from '../../models/Branch.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter } from '../../middleware/branchScope.js';
import { validate, query } from '../../middleware/validate.js';
import { ok, sumField as sum } from '../../utils/http.js';
import { addDaysIso, d, dayBounds, isoToDate, todayIso } from '../../utils/dates.js';

export const reportsRouter = Router();

const dateRange = (from: string, to: string) => ({ date: { $gte: from, $lte: to } });

/** Executive dashboard: KPIs for the range, today's appointment timeline, CRM funnel, trend and branch comparison. */
reportsRouter.get('/dashboard', requirePermission('dashboard:view'), validate(dateRangeQuery, 'query'), async (req, res) => {
  const q = query<typeof dateRangeQuery>(req);
  const from = q.from ?? todayIso();
  const to = q.to ?? todayIso();
  const scope = branchFilter(req);
  const range = { ...scope, ...dateRange(from, to) };
  const today = todayIso();

  const [sales, collections, expenses, invoiceDues, packageDues, newPatients, sessions, apptCounts, leadsByStatus, trend, branches] = await Promise.all([
    sum(Invoice, range, 'grandTotal'),
    sum(Payment, range, 'amount'),
    sum(Expense, range, 'amount'),
    sum(Invoice, { ...scope, paymentStatus: { $in: ['Unpaid', 'Partial'] } }, 'balance'),
    sum(TreatmentPackage, { ...scope, status: { $in: ['Active', 'Paused'] } }, 'balance'),
    Patient.countDocuments({ ...scope, createdAt: { $gte: isoToDate(from), $lte: dayBounds(to).end } }),
    SessionLog.countDocuments({ ...scope, ...dateRange(from, to) }),
    Appointment.aggregate<{ _id: string; count: number }>([{ $match: { ...scope, date: today } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate<{ _id: string; count: number }>([{ $match: { ...scope, createdAt: { $gte: isoToDate(from), $lte: dayBounds(to).end } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate<{ _id: string; total: number }>([{ $match: { ...scope, date: { $gte: addDaysIso(today, -13), $lte: today } } }, { $group: { _id: '$date', total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    Branch.find({ active: true }).select('code name').lean(),
  ]);

  const leadsTotal = leadsByStatus.reduce((s, l) => s + l.count, 0);
  const leadsConverted = leadsByStatus.find((l) => l._id === 'Converted')?.count ?? 0;

  // branch comparison (admin/accounts only see all; others get their own branch)
  const branchIds = branches.map((b) => b._id);
  const [bSales, bColl, bExp, bPat] = await Promise.all([
    Invoice.aggregate<{ _id: unknown; total: number }>([{ $match: { branchId: { $in: branchIds }, ...dateRange(from, to) } }, { $group: { _id: '$branchId', total: { $sum: '$grandTotal' } } }]),
    Payment.aggregate<{ _id: unknown; total: number }>([{ $match: { branchId: { $in: branchIds }, ...dateRange(from, to) } }, { $group: { _id: '$branchId', total: { $sum: '$amount' } } }]),
    Expense.aggregate<{ _id: unknown; total: number }>([{ $match: { branchId: { $in: branchIds }, ...dateRange(from, to) } }, { $group: { _id: '$branchId', total: { $sum: '$amount' } } }]),
    Patient.aggregate<{ _id: unknown; total: number }>([{ $match: { branchId: { $in: branchIds }, createdAt: { $gte: isoToDate(from), $lte: dayBounds(to).end } } }, { $group: { _id: '$branchId', total: { $sum: 1 } } }]),
  ]);
  const pick = (rows: { _id: unknown; total: number }[], id: unknown) => rows.find((r) => String(r._id) === String(id))?.total ?? 0;
  const branchComparison = branches
    .filter((b) => !req.branchId || String(b._id) === req.branchId)
    .map((b) => ({ branchId: String(b._id), code: b.code, name: b.name, sales: pick(bSales, b._id), collections: pick(bColl, b._id), expenses: pick(bExp, b._id), newPatients: pick(bPat, b._id) }));

  const trendDays = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i - 13));
  ok(res, {
    from,
    to,
    kpis: {
      sales: sales.total,
      invoices: sales.count,
      collections: collections.total,
      payments: collections.count,
      expenses: expenses.total,
      pendingDues: invoiceDues.total + packageDues.total,
      invoiceDues: invoiceDues.total,
      packageDues: packageDues.total,
      newPatients,
      sessions,
      net: collections.total - expenses.total,
    },
    today: { date: today, appointments: Object.fromEntries(apptCounts.map((a) => [a._id, a.count])), total: apptCounts.reduce((s, a) => s + a.count, 0) },
    crm: { total: leadsTotal, converted: leadsConverted, conversionRate: leadsTotal ? Math.round((leadsConverted / leadsTotal) * 1000) / 10 : 0, byStatus: Object.fromEntries(leadsByStatus.map((l) => [l._id, l.count])) },
    trend: trendDays.map((day) => ({ date: day, collections: trend.find((t) => t._id === day)?.total ?? 0 })),
    branchComparison,
  });
});

const ieQuery = dateRangeQuery.extend({ groupBy: z.enum(['day', 'month']).default('day') });
reportsRouter.get('/income-expense', requirePermission('reports:view'), validate(ieQuery, 'query'), async (req, res) => {
  const q = query<typeof ieQuery>(req);
  const from = q.from ?? d().startOf('month').format('YYYY-MM-DD');
  const to = q.to ?? todayIso();
  const scope = { ...branchFilter(req), ...dateRange(from, to) };
  const keyExpr = q.groupBy === 'month' ? { $substr: ['$date', 0, 7] } : '$date';
  const [income, expense] = await Promise.all([
    Payment.aggregate<{ _id: string; total: number }>([{ $match: scope }, { $group: { _id: keyExpr, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    Expense.aggregate<{ _id: string; total: number }>([{ $match: scope }, { $group: { _id: keyExpr, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
  ]);
  const keys = [...new Set([...income.map((i) => i._id), ...expense.map((e) => e._id)])].sort();
  ok(res, {
    from,
    to,
    groupBy: q.groupBy,
    rows: keys.map((k) => {
      const inc = income.find((i) => i._id === k)?.total ?? 0;
      const exp = expense.find((e) => e._id === k)?.total ?? 0;
      return { period: k, income: inc, expense: exp, net: inc - exp };
    }),
    totals: { income: income.reduce((s, i) => s + i.total, 0), expense: expense.reduce((s, e) => s + e.total, 0) },
  });
});
