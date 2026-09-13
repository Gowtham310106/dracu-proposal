'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { ROLES, ROLE_LABELS, type Staff } from '@acuheal/types';
import { Badge, Button, Card, DataTable, Input, PageHeader, Select, type Column } from '@/components/ui';
import { staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { StaffModal } from '@/components/StaffModal';
import { fmtDate, inr, mobileDisplay } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export default function StaffPage() {
  const router = useRouter();
  const { branchId, can } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const search = useDebounced(q, 350);

  const { data, isLoading } = useQuery({ queryKey: ['staff', search, role, page, branchId], queryFn: () => staffService.list({ q: search, role, page, limit: 25 }) });

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Staff',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{s.fullName}</p>
          <p className="text-xs text-muted">
            {s.employeeCode} · {s.designation || '—'}
          </p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (s) => <Badge tone="brand">{ROLE_LABELS[s.role]}</Badge> },
    { key: 'contact', header: 'Contact', hideOnMobile: true, render: (s) => <div><p className="tabular-nums">{mobileDisplay(s.mobile)}</p><p className="text-xs text-muted">{s.email}</p></div> },
    { key: 'branches', header: 'Branches', hideOnMobile: true, render: (s) => <span className="flex flex-wrap gap-1">{(s.branches ?? []).map((b) => <Badge key={b._id} tone="stone">{b.code}</Badge>)}</span> },
    { key: 'salary', header: 'Net salary', hideOnMobile: true, render: (s) => <span className="tabular-nums">{inr(s.salary?.net ?? (s.salary?.basic ?? 0) + (s.salary?.allowances ?? 0) - (s.salary?.deductions ?? 0))}</span> },
    { key: 'joined', header: 'Joined', hideOnMobile: true, render: (s) => <span className="text-xs text-muted">{s.joiningDate ? fmtDate(s.joiningDate) : '—'}</span> },
    { key: 'active', header: 'Status', render: (s) => <Badge tone={s.active ? 'green' : 'neutral'}>{s.active ? 'Active' : 'Disabled'}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Staff" subtitle={data?.meta ? `${data.meta.total} staff members` : 'Team directory, roles and salaries'} actions={can('staff:manage') && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add staff</Button>} />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-8" placeholder="Search name, mobile or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-40">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} onRowClick={(s) => router.push(`/staff/${s._id}`)} empty="No staff match these filters." page={data?.meta?.page} pages={data?.meta?.pages} total={data?.meta?.total} onPage={setPage} />
      </Card>

      {adding && <StaffModal onClose={() => setAdding(false)} />}
    </>
  );
}
