'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Plus, Trash2 } from 'lucide-react';
import { defaultValuesFor, EXPENSE_CATEGORIES, EXPENSE_FORM, expenseInput, type Expense } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Badge, Button, Card, DataTable, ErrorNote, Input, Modal, PageHeader, Select, StatCard, type Column } from '@/components/ui';
import { accountsService, branchService, reportService, staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { downloadCsv, ApiError } from '@/lib/api';
import { fmtDate, inr, inrShort, startOfMonth, today } from '@/lib/format';

export default function AccountsPage() {
  const { branchId, can } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const { data: summary } = useQuery({ queryKey: ['accounts-summary', from, to, branchId], queryFn: () => accountsService.summary({ from, to }) });
  const { data: ie } = useQuery({ queryKey: ['income-expense', from, to, branchId], queryFn: () => reportService.incomeExpense({ from, to, groupBy: 'day' }) });
  const { data: expenses, isLoading } = useQuery({ queryKey: ['expenses', from, to, category, page, branchId], queryFn: () => accountsService.expenses({ from, to, category, page, limit: 25 }) });

  const remove = useMutation({
    mutationFn: (id: string) => accountsService.deleteExpense(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['accounts-summary'] });
    },
  });

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'Date', render: (e) => <span className="whitespace-nowrap">{fmtDate(e.date)}</span> },
    { key: 'category', header: 'Category', render: (e) => <Badge tone="stone">{e.category}</Badge> },
    { key: 'description', header: 'Description', render: (e) => <span className="text-gray-700">{e.description}</span> },
    { key: 'vendor', header: 'Vendor', hideOnMobile: true, render: (e) => <span className="text-xs text-muted">{(e as Expense & { vendor?: { name: string } }).vendor?.name ?? '—'}</span> },
    { key: 'mode', header: 'Mode', hideOnMobile: true, render: (e) => <span className="text-xs text-muted">{e.mode}</span> },
    { key: 'amount', header: 'Amount', render: (e) => <span className="font-semibold tabular-nums">{inr(e.amount)}</span> },
    {
      key: 'actions',
      header: '',
      render: (e) =>
        can('accounts:write') ? (
          <button onClick={() => confirm('Delete this expense?') && remove.mutate(e._id)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-point-red" aria-label="Delete expense">
            <Trash2 className="size-4" />
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Collections, expenses and net position"
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void downloadCsv('/accounts/export.csv', { type: 'expenses', from, to }, `expenses-${from}-${to}.csv`)}>
              Export
            </Button>
            {can('accounts:write') && (
              <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Record expense
              </Button>
            )}
          </>
        }
      />

      <Card bodyClass="p-3" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-48">
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collections" value={inr(summary?.collections)} sub={`${summary?.paymentCount ?? 0} payments`} tone="green" />
        <StatCard label="Expenses" value={inr(summary?.expenses)} sub={`${summary?.expenseCount ?? 0} entries`} tone="red" />
        <StatCard label="Salaries & purchases" value={inr((summary?.salaries ?? 0) + (summary?.purchasesPaid ?? 0))} sub={`Salaries ${inrShort(summary?.salaries)}`} tone="stone" />
        <StatCard label="Net position" value={inr(summary?.net)} sub={`Outstanding dues ${inrShort(summary?.outstandingDues)}`} tone={(summary?.net ?? 0) >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Income vs expense" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ie?.rows ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="period" tickFormatter={(v: string) => v.slice(8) || v} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => inrShort(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e3e6ef', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#128a3e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#d81f26" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Expenses by category">
          {(summary?.byCategory.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No expenses in this range.</p>
          ) : (
            <ul className="space-y-2">
              {summary?.byCategory.map((c) => {
                const pct = summary.expenses ? Math.round((c.total / summary.expenses) * 100) : 0;
                return (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{c.category}</span>
                      <span className="font-semibold tabular-nums">{inr(c.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {summary && Object.keys(summary.byMode).length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Collections by mode</p>
              <ul className="space-y-1 text-sm">
                {Object.entries(summary.byMode).map(([mode, total]) => (
                  <li key={mode} className="flex justify-between">
                    <span className="text-gray-700">{mode}</span>
                    <span className="font-semibold tabular-nums">{inr(total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Expense register" className="mt-4" bodyClass="p-0">
        <DataTable columns={columns} rows={expenses?.items ?? []} loading={isLoading} empty="No expenses in this range." page={expenses?.meta?.page} pages={expenses?.meta?.pages} total={expenses?.meta?.total} onPage={setPage} />
      </Card>

      {adding && <ExpenseModal onClose={() => setAdding(false)} />}
    </>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { data: vendors } = useQuery({ queryKey: ['vendors-pick'], queryFn: () => accountsService.vendors({ limit: 200, status: 'active' }) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-pick'], queryFn: staffService.pick });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(expenseInput),
    defaultValues: { ...defaultValuesFor(EXPENSE_FORM), branchId: branchId ?? user?.defaultBranchId ?? '', date: today(), mode: 'Cash' },
  });

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => accountsService.createExpense(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['accounts-summary'] });
      void qc.invalidateQueries({ queryKey: ['income-expense'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the expense'),
  });

  return (
    <Modal open onClose={onClose} wide title="Record expense" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>Save expense</Button></>}>
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={EXPENSE_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          hidden={['attachmentUrl', ...(branches.length <= 1 ? ['branchId'] : [])]}
          slots={{
            vendorId: () => (
              <Select {...form.register('vendorId')}>
                <option value="">No vendor</option>
                {vendors?.items.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            ),
            paidBy: () => (
              <Select {...form.register('paidBy')}>
                <option value="">—</option>
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
