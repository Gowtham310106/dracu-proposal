'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardPlus, IndianRupee } from 'lucide-react';
import { PAYMENT_MODES } from '@acuheal/types';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, SessionMeter, Spinner, Textarea, statusTone } from '@/components/ui';
import { SessionLogModal } from '@/components/SessionLogModal';
import { billingService, packageService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, inr, today } from '@/lib/format';

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [logging, setLogging] = useState(false);
  const [paying, setPaying] = useState(false);

  const { data: pkg, isLoading } = useQuery({ queryKey: ['package', id], queryFn: () => packageService.get(id) });

  if (isLoading || !pkg) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const planName = pkg.customPlanName || pkg.treatmentPlanName;
  const canLog = can('clinical:write') && pkg.status === 'Active' && pkg.sessionsCompleted < pkg.totalSessions;

  return (
    <>
      <PageHeader
        backHref="/packages"
        backLabel="Treatment packages"
        title={planName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{pkg.packageNo}</span>
            <span>·</span>
            <Link href={`/patients/${pkg.patientId}`} className="hover:text-brand-700 hover:underline">
              {pkg.patient?.fullName} ({pkg.patient?.pid})
            </Link>
            <Badge tone={statusTone(pkg.status)}>{pkg.status}</Badge>
          </span>
        }
        actions={
          <>
            {can('payments:write') && pkg.balance > 0 && (
              <Button variant="secondary" icon={<IndianRupee className="size-4" />} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
            {canLog && (
              <Button icon={<ClipboardPlus className="size-4" />} onClick={() => setLogging(true)}>
                Log session
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card bodyClass="p-4">
          <p className="text-xs text-muted">Sessions</p>
          <SessionMeter completed={pkg.sessionsCompleted} total={pkg.totalSessions} className="mt-1.5" />
          <p className="mt-1.5 text-xs text-muted">{pkg.totalSessions - pkg.sessionsCompleted} remaining · {pkg.sessionFrequency.toLowerCase()}</p>
        </Card>
        <Card bodyClass="p-4">
          <p className="text-xs text-muted">Total payable</p>
          <p className="mt-1 text-2xl font-bold">{inr(pkg.totalPayable)}</p>
          <p className="mt-0.5 text-xs text-muted">{pkg.pricingMode === 'Per-session' ? `${inr(pkg.perSessionFee)} × ${pkg.totalSessions} sessions` : 'Package price'}{pkg.discount ? ` · ${inr(pkg.discount)} discount` : ''}</p>
        </Card>
        <Card bodyClass="p-4">
          <p className="text-xs text-muted">Paid</p>
          <p className="mt-1 text-2xl font-bold text-point-green">{inr(pkg.totalPaid)}</p>
          <p className="mt-0.5 text-xs text-muted">{pkg.payments.length} payments</p>
        </Card>
        <Card bodyClass="p-4">
          <p className="text-xs text-muted">Balance</p>
          <p className={`mt-1 text-2xl font-bold ${pkg.balance > 0 ? 'text-point-red' : 'text-point-green'}`}>{inr(pkg.balance)}</p>
          <p className="mt-0.5 text-xs text-muted">{pkg.balance > 0 ? 'Pending collection' : 'Fully settled'}</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card title={`Session log (${pkg.sessions.length})`} bodyClass="p-0">
          {pkg.sessions.length === 0 ? (
            <EmptyState title="No sessions logged yet" hint="Each logged session advances the meter and is added to the patient's clinical history." action={canLog && <Button size="sm" onClick={() => setLogging(true)}>Log the first session</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {[...pkg.sessions].reverse().map((s) => (
                <li key={s._id} className="p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{s.sessionNumber}</span>
                    <span className="text-sm font-semibold">{fmtDate(s.date)}</span>
                    {s.patientResponse && <Badge tone={statusTone(s.patientResponse)}>{s.patientResponse}</Badge>}
                    {s.painScaleBefore != null && s.painScaleAfter != null && (
                      <Badge tone="stone">
                        Pain {s.painScaleBefore} → {s.painScaleAfter}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted">{(s as { doctor?: { fullName: string } }).doctor?.fullName}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-gray-700">{s.observations}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.technique?.map((t) => (
                      <Badge key={t} tone="brand">
                        {t}
                      </Badge>
                    ))}
                    {s.pointsUsed?.map((p) => (
                      <Badge key={p} tone="neutral">
                        {p}
                      </Badge>
                    ))}
                    {s.needleRetentionMinutes ? <Badge tone="neutral">{s.needleRetentionMinutes} min retention</Badge> : null}
                  </div>
                  {s.adverseEvents && <p className="mt-1.5 text-xs font-medium text-point-red">Adverse: {s.adverseEvents}</p>}
                  {s.nextSessionAdvice && <p className="mt-1 text-xs text-muted">Next: {s.nextSessionAdvice}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Payments" bodyClass="p-0">
            {pkg.payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pkg.payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{inr(p.amount)}</p>
                      <p className="text-xs text-muted">
                        {fmtDate(p.date)} · {p.mode}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{p.receiptNo}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Plan details">
            <dl className="space-y-2 text-sm">
              {[
                ['Started', fmtDate(pkg.startDate)],
                ['Expected end', pkg.expectedEndDate ? fmtDate(pkg.expectedEndDate) : '—'],
                ['Frequency', pkg.sessionFrequency],
                ['Doctor', pkg.doctor?.fullName ?? 'Unassigned'],
                ['Pricing', pkg.pricingMode],
                ['Notes', pkg.notes || '—'],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-2 gap-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      {logging && <SessionLogModal open onClose={() => setLogging(false)} packageId={pkg._id} packageLabel={planName} completed={pkg.sessionsCompleted} total={pkg.totalSessions} />}
      {paying && <PackagePaymentModal packageId={pkg._id} balance={pkg.balance} onClose={() => setPaying(false)} />}
    </>
  );
}

function PackagePaymentModal({ packageId, balance, onClose }: { packageId: string; balance: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => billingService.recordPayment({ packageId, amount: Number(amount), mode, date: today(), reference: reference || undefined, remarks: remarks || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['package', packageId] });
      void qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not record the payment'),
  });

  return (
    <Modal open onClose={onClose} title="Record payment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Record {inr(Number(amount) || 0)}</Button></>}>
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm">
          Outstanding balance: <span className="font-bold">{inr(balance)}</span>
        </p>
        <Field label="Amount (₹)" required>
          <Input type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Mode" required>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        {['UPI', 'Card', 'Bank transfer'].includes(mode) && (
          <Field label="Reference / UTR">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <Field label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
