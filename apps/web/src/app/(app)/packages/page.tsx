'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { PACKAGE_STATUS, type TreatmentPackage } from '@acuheal/types';
import { Badge, Card, DataTable, Input, PageHeader, Select, SessionMeter, statusTone, type Column } from '@/components/ui';
import { packageService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { fmtDate, inr } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function PackagesPage() {
  const router = useRouter();
  const { branchId } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Active');
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 350);

  const { data, isLoading } = useQuery({ queryKey: ['packages', search, status, page, branchId], queryFn: () => packageService.list({ q: search, status, page, limit: 25 }) });

  const columns: Column<TreatmentPackage>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.patient?.fullName ?? '—'}</p>
          <p className="text-xs text-muted">
            {p.patient?.pid} · {p.packageNo}
          </p>
        </div>
      ),
    },
    { key: 'plan', header: 'Treatment plan', render: (p) => <span className="text-gray-700">{p.customPlanName || p.treatmentPlanName}</span> },
    { key: 'sessions', header: 'Sessions', render: (p) => <SessionMeter completed={p.sessionsCompleted} total={p.totalSessions} /> },
    { key: 'doctor', header: 'Doctor', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{p.doctor?.fullName ?? 'Unassigned'}</span> },
    { key: 'fees', header: 'Payable', hideOnMobile: true, render: (p) => <span className="font-semibold tabular-nums">{inr(p.totalPayable)}</span> },
    { key: 'balance', header: 'Balance', render: (p) => <span className={p.balance > 0 ? 'font-semibold tabular-nums text-point-red' : 'tabular-nums text-muted'}>{inr(p.balance)}</span> },
    { key: 'start', header: 'Started', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{fmtDate(p.startDate)}</span> },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={statusTone(p.status)}>{p.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Treatment packages" subtitle={data?.meta ? `${data.meta.total} packages` : 'Session and fee tracker'} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-8" placeholder="Search package number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
            <option value="">All statuses</option>
            {PACKAGE_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} onRowClick={(p) => router.push(`/packages/${p._id}`)} empty="No treatment packages match these filters." page={data?.meta?.page} pages={data?.meta?.pages} total={data?.meta?.total} onPage={setPage} />
      </Card>
    </>
  );
}
