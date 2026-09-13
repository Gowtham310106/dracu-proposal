'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, Plus, Search } from 'lucide-react';
import { PAYMENT_MODES, PAYMENT_STATUS, type Invoice, type Payment } from '@acuheal/types';
import { Badge, Button, Card, DataTable, Input, PageHeader, Select, Tabs, statusTone, type Column } from '@/components/ui';
import { billingService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { downloadCsv } from '@/lib/api';
import { daysAgo, fmtDate, inr, today } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function BillingPage() {
  const router = useRouter();
  const { branchId, can } = useAuth();
  const [tab, setTab] = useState('invoices');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 350);

  const invoices = useQuery({ queryKey: ['invoices', search, status, from, to, page, branchId], queryFn: () => billingService.invoices({ q: search, paymentStatus: status, from, to, page, limit: 25 }), enabled: tab === 'invoices' });
  const payments = useQuery({ queryKey: ['payments', mode, from, to, page, branchId], queryFn: () => billingService.payments({ mode, from, to, page, limit: 25 }), enabled: tab === 'payments' });

  const invoiceCols: Column<Invoice>[] = [
    { key: 'no', header: 'Invoice', render: (i) => <span className="font-semibold whitespace-nowrap">{i.invoiceNo}</span> },
    {
      key: 'patient',
      header: 'Patient',
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{i.patient?.fullName ?? '—'}</p>
          <p className="text-xs text-muted">{i.patient?.pid}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', hideOnMobile: true, render: (i) => <span className="text-xs text-muted">{fmtDate(i.date)}</span> },
    { key: 'total', header: 'Total', render: (i) => <span className="font-semibold tabular-nums">{inr(i.grandTotal)}</span> },
    { key: 'paid', header: 'Paid', hideOnMobile: true, render: (i) => <span className="tabular-nums text-point-green">{inr(i.amountPaid)}</span> },
    { key: 'balance', header: 'Balance', render: (i) => <span className={i.balance > 0 ? 'font-semibold tabular-nums text-point-red' : 'tabular-nums text-muted'}>{inr(i.balance)}</span> },
    { key: 'status', header: 'Status', render: (i) => <Badge tone={statusTone(i.paymentStatus)}>{i.paymentStatus}</Badge> },
  ];

  const paymentCols: Column<Payment>[] = [
    { key: 'receipt', header: 'Receipt', render: (p) => <span className="font-semibold whitespace-nowrap">{p.receiptNo}</span> },
    { key: 'patient', header: 'Patient', render: (p) => <span className="font-medium">{(p as Payment & { patient?: { fullName: string } }).patient?.fullName ?? '—'}</span> },
    { key: 'date', header: 'Date', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{fmtDate(p.date)}</span> },
    { key: 'amount', header: 'Amount', render: (p) => <span className="font-semibold tabular-nums">{inr(p.amount)}</span> },
    { key: 'mode', header: 'Mode', render: (p) => <Badge tone="stone">{p.mode}</Badge> },
    { key: 'ref', header: 'Reference', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{p.reference || '—'}</span> },
    { key: 'by', header: 'Received by', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{(p as Payment & { receiver?: { fullName: string } }).receiver?.fullName ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Invoices, receipts and collections"
        actions={
          <>
            {can('accounts:read') && (
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void downloadCsv('/accounts/export.csv', { type: tab === 'payments' ? 'payments' : 'invoices', from, to }, `${tab}-${from}-${to}.csv`)}>
                Export CSV
              </Button>
            )}
            {can('billing:write') && (
              <Link href="/billing/new">
                <Button icon={<Plus className="size-4" />}>New invoice</Button>
              </Link>
            )}
          </>
        }
      />

      <Card bodyClass="p-0">
        <div className="px-3 pt-2">
          <Tabs tabs={[{ id: 'invoices', label: 'Invoices' }, { id: 'payments', label: 'Payments' }]} active={tab} onChange={(t) => { setTab(t); setPage(1); }} />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          {tab === 'invoices' && (
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-8" placeholder="Search invoice number or patient…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          )}
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
          {tab === 'invoices' ? (
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
              <option value="">All statuses</option>
              {PAYMENT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <Select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} className="w-36">
              <option value="">All modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </div>

        {tab === 'invoices' ? (
          <DataTable columns={invoiceCols} rows={invoices.data?.items ?? []} loading={invoices.isLoading} onRowClick={(i) => router.push(`/billing/${i._id}`)} empty="No invoices in this range." page={invoices.data?.meta?.page} pages={invoices.data?.meta?.pages} total={invoices.data?.meta?.total} onPage={setPage} />
        ) : (
          <DataTable columns={paymentCols} rows={payments.data?.items ?? []} loading={payments.isLoading} empty="No payments in this range." page={payments.data?.meta?.page} pages={payments.data?.meta?.pages} total={payments.data?.meta?.total} onPage={setPage} />
        )}
      </Card>
    </>
  );
}
