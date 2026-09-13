'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, IndianRupee, TrendingDown, UserPlus, Wallet, Activity } from 'lucide-react';
import { Badge, Card, PageHeader, Select, StatCard, statusTone } from '@/components/ui';
import { reportService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { daysAgo, fmtDate, inr, inrShort, startOfMonth, today } from '@/lib/format';

const RANGES = [
  { id: 'today', label: 'Today', from: today, to: today },
  { id: 'week', label: 'Last 7 days', from: () => daysAgo(6), to: today },
  { id: 'month', label: 'This month', from: startOfMonth, to: today },
  { id: 'quarter', label: 'Last 90 days', from: () => daysAgo(89), to: today },
];

export default function DashboardPage() {
  const [rangeId, setRangeId] = useState('month');
  const { branchId, user } = useAuth();
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[2]!;
  const from = range.from();
  const to = range.to();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', from, to, branchId],
    queryFn: () => reportService.dashboard({ from, to }),
  });

  const k = data?.kpis;
  const appt = data?.today.appointments ?? {};

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user?.fullName.split(' ').slice(0, 2).join(' ')}`}
        subtitle={`${fmtDate(from)} — ${fmtDate(to)}${branchId ? '' : ' · all branches'}`}
        actions={
          <Select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="w-44">
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collections" value={isLoading ? '—' : inr(k?.collections)} sub={`${k?.payments ?? 0} payments received`} tone="green" icon={<IndianRupee className="size-5" />} />
        <StatCard label="Billed" value={isLoading ? '—' : inr(k?.sales)} sub={`${k?.invoices ?? 0} invoices raised`} tone="brand" icon={<Wallet className="size-5" />} />
        <StatCard label="Expenses" value={isLoading ? '—' : inr(k?.expenses)} sub={`Net ${inr(k?.net)}`} tone="red" icon={<TrendingDown className="size-5" />} />
        <StatCard label="Pending dues" value={isLoading ? '—' : inr(k?.pendingDues)} sub={`Invoices ${inrShort(k?.invoiceDues)} · packages ${inrShort(k?.packageDues)}`} tone="amber" icon={<Activity className="size-5" />} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New patients" value={k?.newPatients ?? 0} sub="Registered in range" tone="brand" icon={<UserPlus className="size-5" />} />
        <StatCard label="Sessions logged" value={k?.sessions ?? 0} sub="Acupuncture sessions" tone="green" icon={<Activity className="size-5" />} />
        <StatCard label="Today's appointments" value={data?.today.total ?? 0} sub={`${appt.Completed ?? 0} completed · ${appt.Booked ?? 0} upcoming`} tone="stone" icon={<CalendarCheck className="size-5" />} />
        <StatCard label="Enquiry conversion" value={`${data?.crm.conversionRate ?? 0}%`} sub={`${data?.crm.converted ?? 0} of ${data?.crm.total ?? 0} leads`} tone="amber" icon={<TrendingDown className="size-5 rotate-180" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Collections, last 14 days" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3a49a8" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#3a49a8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => inrShort(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(l: string) => fmtDate(l)} contentStyle={{ borderRadius: 10, border: '1px solid #e3e6ef', fontSize: 12 }} />
                <Area type="monotone" dataKey="collections" stroke="#2b3585" strokeWidth={2} fill="url(#collGrad)" name="Collections" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Today's schedule" action={<Link href="/appointments" className="text-xs font-semibold text-brand-700 hover:underline">Open</Link>}>
          {Object.keys(appt).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No appointments booked for today.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(appt).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                  <Badge tone={statusTone(status)}>{status}</Badge>
                  <span className="text-sm font-bold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {(data?.branchComparison.length ?? 0) > 1 && (
        <Card title="Branch comparison" className="mt-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.branchComparison ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => inrShort(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e3e6ef', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="collections" name="Collections" fill="#2b3585" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#d81f26" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {data?.branchComparison.map((b) => (
              <div key={b.branchId} className="rounded-lg border border-line px-3 py-2">
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {b.newPatients} new patients · billed {inrShort(b.sales)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
