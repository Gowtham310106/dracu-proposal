'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Pencil } from 'lucide-react';
import { defaultValuesFor, ROLE_LABELS, SALARY_PAYMENT_FORM, salaryPaymentInput } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { StaffModal } from '@/components/StaffModal';
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, PageHeader, Spinner } from '@/components/ui';
import { staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, inr, mobileDisplay, today } from '@/lib/format';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  const { data: staff, isLoading } = useQuery({ queryKey: ['staff-member', id], queryFn: () => staffService.get(id) });
  const { data: payments = [] } = useQuery({ queryKey: ['salary-payments', id], queryFn: () => staffService.salaryPayments(id), enabled: can('salary:manage') });

  const setActive = useMutation({
    mutationFn: (active: boolean) => staffService.setActive(id, active),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-member', id] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  if (isLoading || !staff) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const net = staff.salary?.net ?? (staff.salary?.basic ?? 0) + (staff.salary?.allowances ?? 0) - (staff.salary?.deductions ?? 0);

  return (
    <>
      <PageHeader
        backHref="/staff"
        backLabel="Staff"
        title={staff.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{staff.employeeCode}</span>
            <Badge tone="brand">{ROLE_LABELS[staff.role]}</Badge>
            <Badge tone={staff.active ? 'green' : 'neutral'}>{staff.active ? 'Active' : 'Disabled'}</Badge>
          </span>
        }
        actions={
          can('staff:manage') && (
            <>
              <Button variant="secondary" onClick={() => setActive.mutate(!staff.active)} loading={setActive.isPending}>
                {staff.active ? 'Disable login' : 'Enable login'}
              </Button>
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="space-y-2.5 text-sm">
            {[
              ['Mobile', mobileDisplay(staff.mobile)],
              ['Email', staff.email],
              ['Designation', staff.designation || '—'],
              ['Qualification', staff.qualification || '—'],
              ['Joined', staff.joiningDate ? fmtDate(staff.joiningDate) : '—'],
              ['Biometric ID', staff.biometricUserId || 'Not enrolled'],
              ['Branches', (staff.branches ?? []).map((b) => b.name).join(', ') || '—'],
              ['Last login', staff.lastLoginAt ? fmtDate(staff.lastLoginAt) : 'Never'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="col-span-2 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {can('salary:manage') && (
          <Card title="Salary structure" action={<Button size="sm" icon={<IndianRupee className="size-4" />} onClick={() => setPaying(true)}>Record payment</Button>}>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Basic', inr(staff.salary?.basic)],
                ['Allowances', inr(staff.salary?.allowances)],
                ['Deductions', `− ${inr(staff.salary?.deductions)}`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="col-span-2 font-medium tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3 border-t border-line pt-2">
                <dt className="font-semibold">Net monthly</dt>
                <dd className="col-span-2 text-base font-bold tabular-nums">{inr(net)}</dd>
              </div>
            </dl>
            {staff.bankDetails?.accountNo && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted">
                {staff.bankDetails.accountName} · {staff.bankDetails.accountNo} · {staff.bankDetails.ifsc}
                {staff.bankDetails.upi ? ` · ${staff.bankDetails.upi}` : ''}
              </p>
            )}
          </Card>
        )}
      </div>

      {can('salary:manage') && (
        <Card title={`Salary payments (${payments.length})`} className="mt-4" bodyClass="p-0">
          {payments.length === 0 ? (
            <EmptyState title="No salary payments recorded" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5">Paid on</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Mode</th>
                  <th className="px-3 py-2.5">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{p.month}</td>
                    <td className="px-3 py-2.5">{fmtDate(p.paidOn)}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{inr(p.amount)}</td>
                    <td className="px-3 py-2.5">{p.mode}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {editing && <StaffModal staff={staff} onClose={() => setEditing(false)} />}
      {paying && <SalaryModal staffId={id} defaultAmount={net} onClose={() => setPaying(false)} />}
    </>
  );
}

function SalaryModal({ staffId, defaultAmount, onClose }: { staffId: string; defaultAmount: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const form = useForm<Record<string, unknown>>({
    resolver: resolver(salaryPaymentInput),
    defaultValues: { ...defaultValuesFor(SALARY_PAYMENT_FORM), month: today().slice(0, 7), amount: defaultAmount, paidOn: today(), mode: 'Bank transfer' },
  });

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => staffService.paySalary(staffId, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['salary-payments', staffId] });
      void qc.invalidateQueries({ queryKey: ['accounts-summary'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not record the salary payment'),
  });

  return (
    <Modal open onClose={onClose} title="Record salary payment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>Record payment</Button></>}>
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer definition={SALARY_PAYMENT_FORM} control={form.control} errors={form.formState.errors} watch={form.watch} />
      </div>
    </Modal>
  );
}
