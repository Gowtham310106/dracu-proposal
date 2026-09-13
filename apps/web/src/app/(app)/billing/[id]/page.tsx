'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Printer } from 'lucide-react';
import { PAYMENT_MODES } from '@acuheal/types';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '@/components/ui';
import { billingService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, inr, mobileDisplay, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SectionLoader } from '@/components/BrandLoader';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [layout, setLayout] = useState<'a4' | 'thermal'>((params.get('layout') as 'a4' | 'thermal') ?? 'a4');

  const { data: invoice, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => billingService.invoice(id) });
  const markPrinted = useMutation({ mutationFn: () => billingService.markPrinted(id) });

  if (isLoading || !invoice) {
    return (
      <SectionLoader />
    );
  }

  const print = () => {
    markPrinted.mutate();
    setTimeout(() => window.print(), 80);
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
        backHref="/billing"
        backLabel="Billing"
          title={invoice.invoiceNo}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Link href={`/patients/${invoice.patientId}`} className="hover:text-brand-700 hover:underline">
                {invoice.patient?.fullName} ({invoice.patient?.pid})
              </Link>
              <Badge tone={statusTone(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge>
            </span>
          }
          actions={
            <>
              <Select value={layout} onChange={(e) => setLayout(e.target.value as 'a4' | 'thermal')} className="w-36">
                <option value="a4">A4 layout</option>
                <option value="thermal">80mm thermal</option>
              </Select>
              {can('payments:write') && invoice.balance > 0 && (
                <Button variant="secondary" icon={<IndianRupee className="size-4" />} onClick={() => setPaying(true)}>
                  Record payment
                </Button>
              )}
              <Button icon={<Printer className="size-4" />} onClick={print}>
                Print
              </Button>
            </>
          }
        />
      </div>

      <div className={cn('mx-auto bg-white', layout === 'thermal' ? 'max-w-[80mm] p-3 text-[11px]' : 'max-w-3xl card p-8')}>
        <header className={cn('flex items-start justify-between gap-4', layout === 'thermal' && 'flex-col items-center text-center')}>
          <div>
            <Image src="/brand/logo.png" alt="Dr. Bharath's Acu Heal" width={layout === 'thermal' ? 180 : 220} height={60} />
            <p className={cn('mt-2 font-semibold', layout === 'thermal' ? 'text-[11px]' : 'text-sm')}>{invoice.branch?.name}</p>
            <p className={cn('text-muted', layout === 'thermal' ? 'text-[10px]' : 'text-xs')}>
              {[invoice.branch?.address, invoice.branch?.city].filter(Boolean).join(', ')}
              <br />
              {mobileDisplay(invoice.branch?.phone)}
              {invoice.branch?.gstin ? ` · GSTIN ${invoice.branch.gstin}` : ''}
            </p>
          </div>
          <div className={cn(layout === 'thermal' ? 'text-center' : 'text-right')}>
            <p className={cn('font-bold', layout === 'thermal' ? 'text-sm' : 'text-lg')}>INVOICE</p>
            <p className="text-xs font-semibold">{invoice.invoiceNo}</p>
            <p className="text-xs text-muted">{fmtDate(invoice.date)}</p>
          </div>
        </header>

        <section className={cn('mt-5 border-t border-line pt-3', layout === 'thermal' && 'mt-3')}>
          <p className="text-xs text-muted">Billed to</p>
          <p className="text-sm font-semibold">{invoice.patient?.fullName}</p>
          <p className="text-xs text-muted">
            {invoice.patient?.pid} · {mobileDisplay(invoice.patient?.mobile)}
            {invoice.patient?.addressLine ? <><br />{[invoice.patient.addressLine, invoice.patient.city].filter(Boolean).join(', ')}</> : null}
          </p>
        </section>

        <table className={cn('mt-4 w-full', layout === 'thermal' ? 'text-[10px]' : 'text-sm')}>
          <thead>
            <tr className="border-y border-line text-left">
              <th className="py-1.5 font-semibold">Description</th>
              <th className="w-10 py-1.5 text-center font-semibold">Qty</th>
              <th className="w-20 py-1.5 text-right font-semibold">Rate</th>
              <th className="w-24 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-1.5">
                  {item.description}
                  <span className="block text-[10px] text-muted">{item.type}</span>
                </td>
                <td className="py-1.5 text-center tabular-nums">{item.qty}</td>
                <td className="py-1.5 text-right tabular-nums">{inr(item.unitPrice)}</td>
                <td className="py-1.5 text-right tabular-nums">{inr(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className={cn('mt-3 ml-auto space-y-1', layout === 'thermal' ? 'text-[10px]' : 'w-64 text-sm')}>
          <Row label="Subtotal" value={inr(invoice.subtotal)} />
          {invoice.discount > 0 && <Row label="Discount" value={`− ${inr(invoice.discount)}`} />}
          {invoice.taxAmount > 0 && <Row label={`Tax (${invoice.taxPercent}%)`} value={inr(invoice.taxAmount)} />}
          <Row label="Grand total" value={inr(invoice.grandTotal)} bold />
          <Row label="Paid" value={inr(invoice.amountPaid)} />
          <Row label="Balance" value={inr(invoice.balance)} bold />
        </section>

        {invoice.package && (
          <p className={cn('mt-3 rounded bg-gray-50 px-2 py-1.5', layout === 'thermal' ? 'text-[10px]' : 'text-xs')}>
            Treatment package {invoice.package.packageNo} — session {invoice.package.sessionsCompleted} of {invoice.package.totalSessions} completed.
          </p>
        )}

        {invoice.payments.length > 0 && (
          <section className={cn('mt-3', layout === 'thermal' ? 'text-[10px]' : 'text-xs')}>
            <p className="font-semibold">Payments received</p>
            <ul className="mt-1 space-y-0.5">
              {invoice.payments.map((p) => (
                <li key={p._id} className="flex justify-between text-muted">
                  <span>
                    {fmtDate(p.date)} · {p.mode}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className="tabular-nums">{inr(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invoice.notes && <p className={cn('mt-3 text-muted', layout === 'thermal' ? 'text-[10px]' : 'text-xs')}>{invoice.notes}</p>}

        <footer className={cn('mt-6 border-t border-line pt-3 text-center text-muted', layout === 'thermal' ? 'text-[9px]' : 'text-xs')}>
          <p>Thank you for choosing Dr. Bharath&apos;s Acu Heal. Get well soon.</p>
          <p className="mt-0.5">This is a computer-generated invoice.</p>
        </footer>
      </div>

      {paying && <InvoicePaymentModal invoiceId={invoice._id} balance={invoice.balance} onClose={() => setPaying(false)} onDone={() => void qc.invalidateQueries({ queryKey: ['invoice', id] })} />}
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between', bold && 'border-t border-line pt-1 font-bold')}>
      <span className={bold ? '' : 'text-muted'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function InvoicePaymentModal({ invoiceId, balance, onClose, onDone }: { invoiceId: string; balance: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => billingService.recordPayment({ invoiceId, amount: Number(amount), mode, date: today(), reference: reference || undefined, remarks: remarks || undefined }),
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not record the payment'),
  });

  return (
    <Modal open onClose={onClose} title="Record payment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Record {inr(Number(amount) || 0)}</Button></>}>
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm">
          Invoice balance: <span className="font-bold">{inr(balance)}</span>
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
