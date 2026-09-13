'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { defaultValuesFor, LEAD_FORM, LEAD_SOURCES, LEAD_STATUS, leadInput, type Lead } from '@acuheal/types';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, PageHeader, Select, StatCard, Tabs, statusTone } from '@/components/ui';
import { branchService, leadService, staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, mobileDisplay, relative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SectionLoader } from '@/components/BrandLoader';

export default function CrmPage() {
  const { branchId, can } = useAuth();
  const [view, setView] = useState('board');
  const [source, setSource] = useState('');
  const [due, setDue] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['leads', source, due, branchId], queryFn: () => leadService.list({ source, due, limit: 200 }) });
  const { data: stats } = useQuery({ queryKey: ['lead-stats', branchId], queryFn: () => leadService.stats() });

  const leads = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Enquiries"
        subtitle="Lead pipeline from Instagram, Google, walk-ins and referrals"
        actions={can('crm:write') && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New enquiry</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total enquiries" value={stats?.total ?? 0} tone="brand" />
        <StatCard label="Converted" value={stats?.converted ?? 0} sub={`${stats?.conversionRate ?? 0}% conversion`} tone="green" />
        <StatCard label="In follow-up" value={stats?.byStatus['Follow-up'] ?? 0} tone="amber" />
        <StatCard label="Lost" value={stats?.byStatus.Lost ?? 0} tone="red" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tabs tabs={[{ id: 'board', label: 'Pipeline' }, { id: 'sources', label: 'By source' }]} active={view} onChange={setView} />
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="ml-auto w-40">
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={due} onChange={(e) => setDue(e.target.value)} className="w-44">
          <option value="">All follow-ups</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
        </Select>
      </div>

      {isLoading ? (
        <SectionLoader />
      ) : view === 'board' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {LEAD_STATUS.map((status) => {
            const column = leads.filter((l) => l.status === status);
            return (
              <section key={status} className="card flex min-h-32 flex-col">
                <header className="flex items-center justify-between border-b border-line px-3 py-2">
                  <Badge tone={statusTone(status)}>{status}</Badge>
                  <span className="text-xs font-semibold text-muted">{column.length}</span>
                </header>
                <ul className="flex-1 space-y-2 p-2">
                  {column.map((lead) => (
                    <li key={lead._id}>
                      <Link href={`/crm/${lead._id}`} className="block rounded-lg border border-line p-2.5 hover:border-brand-300 hover:bg-brand-50/40">
                        <p className="truncate text-sm font-semibold">{lead.name}</p>
                        <p className="text-xs text-muted">{mobileDisplay(lead.mobile)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge tone="stone">{lead.source}</Badge>
                          {lead.interestedIn && <Badge tone="neutral">{lead.interestedIn}</Badge>}
                        </div>
                        {lead.nextFollowUpAt && (
                          <p className={cn('mt-1.5 text-xs font-medium', new Date(lead.nextFollowUpAt) < new Date() ? 'text-point-red' : 'text-muted')}>Follow up {relative(lead.nextFollowUpAt)}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                  {column.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">Empty</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Card title="Conversion by source" className="mt-4" bodyClass="p-0">
          {(stats?.bySource.length ?? 0) === 0 ? (
            <EmptyState title="No enquiries recorded yet" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Enquiries</th>
                  <th className="px-3 py-2.5">Converted</th>
                  <th className="px-3 py-2.5">Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats?.bySource.map((s) => (
                  <tr key={s.source} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{s.source}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.total}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.converted}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${s.rate}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums">{s.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {creating && <LeadFormModal onClose={() => setCreating(false)} />}
    </>
  );
}

function LeadFormModal({ onClose }: { onClose: () => void }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [duplicate, setDuplicate] = useState<{ leadNo: string; name: string } | null>(null);

  const { data: staff = [] } = useQuery({ queryKey: ['staff-pick'], queryFn: staffService.pick });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(leadInput),
    defaultValues: { ...defaultValuesFor(LEAD_FORM), branchId: branchId ?? user?.defaultBranchId ?? '', status: 'New', source: 'Instagram' },
  });

  const mutation = useMutation({
    mutationFn: ({ values, force }: { values: Record<string, unknown>; force?: boolean }) => leadService.create(values, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['lead-stats'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        const d = err.details as { leadNo?: string; name?: string } | undefined;
        setDuplicate({ leadNo: d?.leadNo ?? '', name: d?.name ?? '' });
        setServerError(err.message);
      } else setServerError(err instanceof ApiError ? err.message : 'Could not save the enquiry');
    },
  });

  const submit = (force?: boolean) =>
    form.handleSubmit((values) => {
      setServerError('');
      mutation.mutate({ values, force });
    })();

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="New enquiry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {duplicate ? (
            <Button variant="danger" loading={mutation.isPending} onClick={() => void submit(true)}>
              Save anyway
            </Button>
          ) : (
            <Button loading={mutation.isPending} onClick={() => void submit()}>
              Save enquiry
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}{duplicate?.leadNo ? ` (${duplicate.leadNo} — ${duplicate.name})` : ''}</ErrorNote>}
        <FormRenderer
          definition={LEAD_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          hidden={branches.length <= 1 ? ['branchId'] : []}
          slots={{
            assignedTo: () => (
              <Select {...form.register('assignedTo')}>
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
            ),
            branchId: () => (
              <Select {...form.register('branchId')}>
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            ),
          }}
        />
      </div>
    </Modal>
  );
}
