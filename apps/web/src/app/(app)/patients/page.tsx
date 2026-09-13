'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { GENDERS, REFERRAL_SOURCES, type Patient } from '@acuheal/types';
import { Badge, Button, Card, DataTable, Input, PageHeader, Select, type Column } from '@/components/ui';
import { patientService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { fmtDate, initials, mobileDisplay, relative } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function PatientsPage() {
  const router = useRouter();
  const { branchId, can } = useAuth();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('Active');
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, gender, source, status, page, branchId],
    queryFn: () => patientService.list({ q: search, gender, referralSource: source, status, page, limit: 25 }),
  });

  const columns: Column<Patient>[] = [
    {
      key: 'name',
      header: 'Patient',
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{initials(p.fullName)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.fullName}</p>
            <p className="text-xs text-muted">
              {p.pid} · {p.gender}
              {p.age ? `, ${p.age}y` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: (p) => <span className="tabular-nums">{mobileDisplay(p.mobile)}</span> },
    { key: 'complaint', header: 'Chief complaint', hideOnMobile: true, render: (p) => <span className="line-clamp-2 max-w-xs text-gray-700">{p.chiefComplaint}</span> },
    { key: 'branch', header: 'Branch', hideOnMobile: true, render: (p) => <Badge tone="stone">{(p as Patient & { branch?: { code: string } }).branch?.code ?? '—'}</Badge> },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{p.referralSource}</span> },
    { key: 'visit', header: 'Last visit', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{p.lastVisitAt ? relative(p.lastVisitAt) : 'Never'}</span> },
    { key: 'registered', header: 'Registered', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{fmtDate(p.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={data?.meta ? `${data.meta.total} records` : 'Patient register'}
        actions={
          can('patients:write') && (
            <Link href="/patients/new">
              <Button icon={<Plus className="size-4" />}>Register patient</Button>
            </Link>
          )
        }
      />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              placeholder="Search name, patient ID or mobile…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
          <Select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} className="w-32">
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="w-40">
            <option value="">All sources</option>
            {REFERRAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} onRowClick={(p) => router.push(`/patients/${p._id}`)} empty="No patients match these filters." page={data?.meta?.page} pages={data?.meta?.pages} total={data?.meta?.total} onPage={setPage} />
      </Card>
    </>
  );
}
