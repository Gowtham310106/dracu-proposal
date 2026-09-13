'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { branchInput, BRANCH_FORM, defaultValuesFor, ROLE_PERMISSIONS, ROLES, ROLE_LABELS, type Branch } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Input, Modal, PageHeader, Select, Tabs, type Column } from '@/components/ui';
import { auditService, branchService } from '@/services';
import { ApiError } from '@/lib/api';
import { fmtDateTime, fmtTime, mobileDisplay } from '@/lib/format';

export default function AdminPage() {
  const [tab, setTab] = useState('branches');
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);

  return (
    <>
      <PageHeader title="Admin" subtitle="Branches, role permissions and the audit trail" actions={tab === 'branches' && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add branch</Button>} />

      <Tabs tabs={[{ id: 'branches', label: 'Branches' }, { id: 'roles', label: 'Roles & permissions' }, { id: 'audit', label: 'Audit log' }]} active={tab} onChange={setTab} />

      <div className="mt-4">
        {tab === 'branches' && <BranchesTab onEdit={setEditing} />}
        {tab === 'roles' && <RolesTab />}
        {tab === 'audit' && <AuditTab />}
      </div>

      {editing && <BranchModal branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BranchesTab({ onEdit }: { onEdit: (b: Branch) => void }) {
  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches', 'all'], queryFn: branchService.list });
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {branches.map((b) => (
        <Card key={b._id} title={<span className="flex items-center gap-2 text-sm font-semibold">{b.name}<Badge tone="stone">{b.code}</Badge></span>} action={<Button size="sm" variant="secondary" onClick={() => onEdit(b)}>Edit</Button>}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Phone</dt>
              <dd className="font-medium tabular-nums">{mobileDisplay(b.phone)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Hours</dt>
              <dd className="font-medium">
                {fmtTime(b.workingHours?.open)} – {fmtTime(b.workingHours?.close)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Slot length</dt>
              <dd className="font-medium">{b.slotDurationMinutes} min</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Reminder hour</dt>
              <dd className="font-medium">{fmtTime(`${String(b.reminderHour ?? 18).padStart(2, '0')}:00`)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Working days</dt>
              <dd className="font-medium">{b.workingDays?.join(', ')}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">{[b.address, b.city, b.state].filter(Boolean).join(', ')}</p>
        </Card>
      ))}
    </div>
  );
}

function RolesTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ROLES.map((role) => (
        <Card key={role} title={ROLE_LABELS[role]}>
          <p className="mb-2 text-xs text-muted">{ROLE_PERMISSIONS[role].length} permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PERMISSIONS[role].map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted md:col-span-2">Role permissions are defined in code so every branch behaves identically. Assign a role to a staff member from the Staff page.</p>
    </div>
  );
}

function AuditTab() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['audit', entity, action, page], queryFn: () => auditService.list({ entity, action, page, limit: 30 }) });

  type Row = { _id: string; action: string; entity: string; summary: string; createdAt: string; user?: { fullName: string; role: string }; branch?: { code: string } };
  const columns: Column<Row>[] = [
    { key: 'at', header: 'When', render: (r) => <span className="whitespace-nowrap text-xs text-muted">{fmtDateTime(r.createdAt)}</span> },
    { key: 'user', header: 'By', render: (r) => <span className="font-medium">{r.user?.fullName ?? 'System'}</span> },
    { key: 'action', header: 'Action', render: (r) => <Badge tone="stone">{r.action}</Badge> },
    { key: 'entity', header: 'Entity', hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{r.entity}</span> },
    { key: 'summary', header: 'Summary', render: (r) => <span className="text-gray-700">{r.summary}</span> },
    { key: 'branch', header: 'Branch', hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{r.branch?.code ?? '—'}</span> },
  ];

  return (
    <Card bodyClass="p-0">
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="w-44">
          <option value="">All entities</option>
          {['Patient', 'Invoice', 'Payment', 'TreatmentPackage', 'SessionLog', 'User', 'Branch', 'Expense', 'Lead', 'Media'].map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-40">
          <option value="">All actions</option>
          {['create', 'update', 'delete', 'status', 'payment', 'login', 'convert', 'print'].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} empty="No audit entries match these filters." page={data?.meta?.page} pages={data?.meta?.pages} total={data?.meta?.total} onPage={setPage} />
    </Card>
  );
}

function BranchModal({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(branchInput),
    defaultValues: branch ? { ...defaultValuesFor(BRANCH_FORM), ...branch } : { ...defaultValuesFor(BRANCH_FORM), active: true, workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], workingHours: { open: '09:00', close: '19:00' }, slotDurationMinutes: 30, reminderHour: 18, state: 'Tamil Nadu' },
  });

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => (branch ? branchService.update(branch._id, values) : branchService.create(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branches'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the branch'),
  });

  return (
    <Modal open onClose={onClose} wide title={branch ? `Edit ${branch.name}` : 'Add branch'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>{branch ? 'Save changes' : 'Create branch'}</Button></>}>
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        {branch && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">The branch code is used in existing patient IDs and invoice numbers. Changing it does not renumber past records.</p>}
        <FormRenderer definition={BRANCH_FORM} control={form.control} errors={form.formState.errors} watch={form.watch} />
      </div>
    </Modal>
  );
}
