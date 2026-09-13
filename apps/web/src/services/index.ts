import type {
  Appointment, AttendanceLog, Branch, Invoice, Lead, MediaItem, MessageLog, MessageTemplate, PageMeta,
  Patient, Payment, PresignResult, SalaryPayment, SessionLog, Slot, Staff, StorageUsage, TreatmentPackage, Vendor,
} from '@acuheal/types';
import { api, type RequestOptions } from '@/lib/api';

type Q = RequestOptions['query'];
export interface Paged<T> {
  items: T[];
  meta?: PageMeta;
}

async function list<T>(path: string, query?: Q): Promise<Paged<T>> {
  const { data, meta } = await api.get<T[]>(path, query);
  return { items: data, meta };
}

/* ---------- Branches & staff ---------- */

export const branchService = {
  list: () => api.get<Branch[]>('/branches').then((r) => r.data),
  get: (id: string) => api.get<Branch>(`/branches/${id}`).then((r) => r.data),
  create: (body: unknown) => api.post<Branch>('/branches', body).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<Branch>(`/branches/${id}`, body).then((r) => r.data),
};

export const staffService = {
  list: (query?: Q) => list<Staff>('/users', query),
  get: (id: string) => api.get<Staff>(`/users/${id}`).then((r) => r.data),
  create: (body: unknown) => api.post<Staff>('/users', body).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<Staff>(`/users/${id}`, body).then((r) => r.data),
  setActive: (id: string, active: boolean) => api.post<Staff>(`/users/${id}/active`, { active }).then((r) => r.data),
  doctors: () => api.get<{ _id: string; fullName: string; designation?: string }[]>('/users/doctors').then((r) => r.data),
  pick: () => api.get<{ _id: string; fullName: string; role: string }[]>('/users/pick').then((r) => r.data),
  salaryPayments: (id: string) => api.get<SalaryPayment[]>(`/users/${id}/salary-payments`).then((r) => r.data),
  paySalary: (id: string, body: unknown) => api.post<SalaryPayment>(`/users/${id}/salary-payments`, body).then((r) => r.data),
  allSalaryPayments: (query?: Q) => list<SalaryPayment>('/users/salary-payments', query),
};

/* ---------- Patients ---------- */

export const patientService = {
  list: (query?: Q) => list<Patient>('/patients', query),
  get: (id: string) => api.get<Patient & { totals: { invoiceDue: number; packageDue: number; mediaCount: number }; activePackage: TreatmentPackage | null }>(`/patients/${id}`).then((r) => r.data),
  create: (body: unknown) => api.post<Patient>('/patients', body).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<Patient>(`/patients/${id}`, body).then((r) => r.data),
  lookup: (mobile: string) => api.get<(Patient & { branch?: { code: string; name: string } })[]>('/patients/lookup', { mobile }).then((r) => r.data),
  search: (q: string) => api.get<Patient[]>('/patients/search', { q }).then((r) => r.data),
  timeline: (id: string) => api.get<{ events: TimelineEvent[]; packages: TreatmentPackage[] }>(`/patients/${id}/timeline`).then((r) => r.data),
};

export interface TimelineEvent {
  kind: 'appointment' | 'session' | 'invoice' | 'payment' | 'media';
  at: string;
  id: string;
  title: string;
  status?: string;
  meta?: Record<string, unknown>;
}

/* ---------- Appointments ---------- */

export const appointmentService = {
  day: (date: string, doctorId?: string) => api.get<{ date: string; branch: { _id: string; code: string; name: string; slotDurationMinutes: number; workingHours: { open: string; close: string } }; slots: Slot[]; appointments: Appointment[]; counts: Record<string, number> }>('/appointments/day', { date, doctorId }).then((r) => r.data),
  list: (query?: Q) => list<Appointment>('/appointments', query),
  get: (id: string) => api.get<Appointment>(`/appointments/${id}`).then((r) => r.data),
  create: (body: unknown) => api.post<Appointment>('/appointments', body).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<Appointment>(`/appointments/${id}`, body).then((r) => r.data),
  setStatus: (id: string, status: string, cancelReason?: string) => api.post<Appointment>(`/appointments/${id}/status`, { status, cancelReason }).then((r) => r.data),
  reschedule: (id: string, body: unknown) => api.post<Appointment>(`/appointments/${id}/reschedule`, body).then((r) => r.data),
  todayQueue: () => api.get<Appointment[]>('/appointments/queue/today').then((r) => r.data),
};

/* ---------- Packages & sessions ---------- */

export const packageService = {
  list: (query?: Q) => list<TreatmentPackage>('/packages', query),
  get: (id: string) => api.get<TreatmentPackage & { sessions: SessionLog[]; payments: Payment[] }>(`/packages/${id}`).then((r) => r.data),
  create: (body: unknown) => api.post<TreatmentPackage>('/packages', body).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<TreatmentPackage>(`/packages/${id}`, body).then((r) => r.data),
  sessions: (id: string) => api.get<SessionLog[]>(`/packages/${id}/sessions`).then((r) => r.data),
  logSession: (id: string, body: unknown) => api.post<{ session: SessionLog; package: { sessionsCompleted: number; totalSessions: number; status: string; balance: number } }>(`/packages/${id}/sessions`, body).then((r) => r.data),
};

/* ---------- Billing ---------- */

export const billingService = {
  invoices: (query?: Q) => list<Invoice>('/billing/invoices', query),
  invoice: (id: string) => api.get<Invoice & { payments: Payment[] }>(`/billing/invoices/${id}`).then((r) => r.data),
  createInvoice: (body: unknown) => api.post<Invoice & { payments: Payment[] }>('/billing/invoices', body).then((r) => r.data),
  markPrinted: (id: string) => api.post<{ printedCount: number }>(`/billing/invoices/${id}/printed`).then((r) => r.data),
  payments: (query?: Q) => list<Payment>('/billing/payments', query),
  recordPayment: (body: unknown) => api.post<Payment>('/billing/payments', body).then((r) => r.data),
};

/* ---------- CRM ---------- */

export const leadService = {
  list: (query?: Q) => list<Lead>('/leads', query),
  get: (id: string) => api.get<Lead>(`/leads/${id}`).then((r) => r.data),
  create: (body: unknown, force?: boolean) => api.post<Lead>('/leads', body, force ? { force: '1' } : undefined).then((r) => r.data),
  update: (id: string, body: unknown) => api.patch<Lead>(`/leads/${id}`, body).then((r) => r.data),
  addFollowUp: (id: string, body: unknown) => api.post<Lead>(`/leads/${id}/follow-ups`, body).then((r) => r.data),
  convert: (id: string, body: unknown) => api.post<{ lead: Lead; patient: Patient }>(`/leads/${id}/convert`, body).then((r) => r.data),
  stats: (query?: Q) => api.get<{ total: number; converted: number; conversionRate: number; byStatus: Record<string, number>; bySource: { source: string; total: number; converted: number; rate: number }[] }>('/leads/stats', query).then((r) => r.data),
};

/* ---------- Accounts ---------- */

export interface AccountsSummary {
  from: string;
  to: string;
  sales: number;
  invoiceCount: number;
  collections: number;
  paymentCount: number;
  byMode: Record<string, number>;
  expenses: number;
  expenseCount: number;
  byCategory: { category: string; total: number }[];
  purchasesPaid: number;
  purchasesTotal: number;
  salaries: number;
  outstandingDues: number;
  net: number;
}

export const accountsService = {
  expenses: (query?: Q) => list<import('@acuheal/types').Expense>('/accounts/expenses', query),
  createExpense: (body: unknown) => api.post('/accounts/expenses', body).then((r) => r.data),
  updateExpense: (id: string, body: unknown) => api.patch(`/accounts/expenses/${id}`, body).then((r) => r.data),
  deleteExpense: (id: string) => api.del(`/accounts/expenses/${id}`).then((r) => r.data),
  vendors: (query?: Q) => list<Vendor>('/accounts/vendors', query),
  vendor: (id: string) => api.get<Vendor & { purchases: import('@acuheal/types').Purchase[] }>(`/accounts/vendors/${id}`).then((r) => r.data),
  createVendor: (body: unknown) => api.post<Vendor>('/accounts/vendors', body).then((r) => r.data),
  updateVendor: (id: string, body: unknown) => api.patch<Vendor>(`/accounts/vendors/${id}`, body).then((r) => r.data),
  purchases: (query?: Q) => list<import('@acuheal/types').Purchase>('/accounts/purchases', query),
  createPurchase: (body: unknown) => api.post('/accounts/purchases', body).then((r) => r.data),
  updatePurchase: (id: string, body: unknown) => api.patch(`/accounts/purchases/${id}`, body).then((r) => r.data),
  summary: (query?: Q) => api.get<AccountsSummary>('/accounts/summary', query).then((r) => r.data),
};

/* ---------- Attendance ---------- */

export const attendanceService = {
  day: (date?: string) => api.get<{ date: string; rows: { staff: { _id: string; fullName: string; role: string; employeeCode: string; biometricUserId?: string }; log: AttendanceLog | null; status: string }[] }>('/attendance/day', { date }).then((r) => r.data),
  summary: (query?: Q) => api.get<{ from: string; to: string; rows: { staffId: string; staffName: string; role?: string; present: number; halfDay: number; leave: number; workedMinutes: number }[] }>('/attendance/summary', query).then((r) => r.data),
  manual: (body: unknown) => api.post<AttendanceLog>('/attendance/manual', body).then((r) => r.data),
  importCsv: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<{ rows: number; processed: number; days: number; unknownDeviceIds: string[] }>('/attendance/import-csv', fd);
    return data;
  },
};

/* ---------- Media ---------- */

export const mediaService = {
  list: (query?: Q) => list<MediaItem>('/media', query),
  usage: () => api.get<StorageUsage>('/media/usage').then((r) => r.data),
  presign: (body: unknown) => api.post<PresignResult>('/media/presign', body).then((r) => r.data),
  confirm: (body: unknown) => api.post<MediaItem>('/media/confirm', body).then((r) => r.data),
  remove: (id: string) => api.del(`/media/${id}`).then((r) => r.data),
  /** presign → PUT the bytes → confirm. Returns the stored media item. */
  upload: async (file: File, meta: { patientId: string; kind: 'Video' | 'Photo'; category: string; title?: string; notes?: string; sessionLogId?: string; capturedAt?: string; durationSec?: number }) => {
    const presigned = await mediaService.presign({ patientId: meta.patientId, kind: meta.kind, category: meta.category, fileName: file.name, mimeType: file.type, sizeBytes: file.size });
    const put = await fetch(presigned.uploadUrl, { method: presigned.method, headers: presigned.headers ?? { 'Content-Type': file.type }, body: file });
    if (!put.ok) throw new Error('Upload failed. Please retry.');
    return mediaService.confirm({ uploadId: presigned.uploadId, title: meta.title, notes: meta.notes, sessionLogId: meta.sessionLogId, capturedAt: meta.capturedAt, durationSec: meta.durationSec });
  },
};

/* ---------- Messaging ---------- */

export const messagingService = {
  templates: () => api.get<MessageTemplate[]>('/messaging/templates').then((r) => r.data),
  createTemplate: (body: unknown) => api.post<MessageTemplate>('/messaging/templates', body).then((r) => r.data),
  updateTemplate: (id: string, body: unknown) => api.patch<MessageTemplate>(`/messaging/templates/${id}`, body).then((r) => r.data),
  deleteTemplate: (id: string) => api.del(`/messaging/templates/${id}`).then((r) => r.data),
  logs: (query?: Q) => list<MessageLog>('/messaging/logs', query),
  send: (body: unknown) => api.post<MessageLog>('/messaging/send', body).then((r) => r.data),
};

/* ---------- Reports ---------- */

export interface DashboardData {
  from: string;
  to: string;
  kpis: { sales: number; invoices: number; collections: number; payments: number; expenses: number; pendingDues: number; invoiceDues: number; packageDues: number; newPatients: number; sessions: number; net: number };
  today: { date: string; appointments: Record<string, number>; total: number };
  crm: { total: number; converted: number; conversionRate: number; byStatus: Record<string, number> };
  trend: { date: string; collections: number }[];
  branchComparison: { branchId: string; code: string; name: string; sales: number; collections: number; expenses: number; newPatients: number }[];
}

export const reportService = {
  dashboard: (query?: Q) => api.get<DashboardData>('/reports/dashboard', query).then((r) => r.data),
  incomeExpense: (query?: Q) => api.get<{ from: string; to: string; groupBy: string; rows: { period: string; income: number; expense: number; net: number }[]; totals: { income: number; expense: number } }>('/reports/income-expense', query).then((r) => r.data),
};

export const auditService = {
  list: (query?: Q) => list<{ _id: string; action: string; entity: string; entityId?: string; summary: string; createdAt: string; user?: { fullName: string; role: string }; branch?: { code: string; name: string } }>('/audit', query),
};
