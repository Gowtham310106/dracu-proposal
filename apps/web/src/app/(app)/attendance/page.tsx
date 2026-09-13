'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { ATTENDANCE_STATUS } from '@acuheal/types';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Tabs, statusTone } from '@/components/ui';
import { attendanceService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, fmtTime, startOfMonth, today } from '@/lib/format';

export default function AttendancePage() {
  const { branchId, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('day');
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<{ staffId: string; fullName: string } | null>(null);

  const day = useQuery({ queryKey: ['attendance-day', date, branchId], queryFn: () => attendanceService.day(date), enabled: tab === 'day' });
  const summary = useQuery({ queryKey: ['attendance-summary', from, to, branchId], queryFn: () => attendanceService.summary({ from, to }), enabled: tab === 'summary' });

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Biometric punches, CSV imports and manual entries"
        actions={can('attendance:manage') && <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImporting(true)}>Import CSV</Button>}
      />

      <Card bodyClass="p-0">
        <div className="px-3 pt-2">
          <Tabs tabs={[{ id: 'day', label: 'Daily view' }, { id: 'summary', label: 'Summary' }]} active={tab} onChange={setTab} />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          {tab === 'day' ? (
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          ) : (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </>
          )}
        </div>

        {tab === 'day' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  <th className="px-3 py-2.5">Staff</th>
                  <th className="px-3 py-2.5">Check-in</th>
                  <th className="px-3 py-2.5">Check-out</th>
                  <th className="px-3 py-2.5">Worked</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Status</th>
                  {can('attendance:manage') && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {(day.data?.rows ?? []).map((row) => (
                  <tr key={row.staff._id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{row.staff.fullName}</p>
                      <p className="text-xs text-muted">
                        {row.staff.employeeCode} · {row.staff.role.replace('_', '-').toLowerCase()}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtTime(row.log?.checkIn)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtTime(row.log?.checkOut)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.log?.workedMinutes ? `${Math.floor(row.log.workedMinutes / 60)}h ${row.log.workedMinutes % 60}m` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{row.log?.source ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                    {can('attendance:manage') && (
                      <td className="px-3 py-2.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ staffId: row.staff._id, fullName: row.staff.fullName })}>
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {(day.data?.rows.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No staff in scope" hint="Add staff and assign them to this branch to track attendance." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  <th className="px-3 py-2.5">Staff</th>
                  <th className="px-3 py-2.5">Present</th>
                  <th className="px-3 py-2.5">Half-day</th>
                  <th className="px-3 py-2.5">Leave</th>
                  <th className="px-3 py-2.5">Total hours</th>
                </tr>
              </thead>
              <tbody>
                {(summary.data?.rows ?? []).map((r) => (
                  <tr key={r.staffId} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{r.staffName}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.present}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.halfDay}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.leave}</td>
                    <td className="px-3 py-2.5 tabular-nums">{Math.round(r.workedMinutes / 60)}h</td>
                  </tr>
                ))}
                {(summary.data?.rows.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No attendance in this range" hint={`Nothing recorded between ${fmtDate(from)} and ${fmtDate(to)}.`} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {importing && <CsvImportModal onClose={() => setImporting(false)} onDone={() => void qc.invalidateQueries({ queryKey: ['attendance-day'] })} />}
      {editing && <ManualEntryModal staff={editing} date={date} onClose={() => setEditing(null)} />}
    </>
  );
}

function CsvImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ rows: number; processed: number; days: number; unknownDeviceIds: string[] } | null>(null);

  const mutation = useMutation({
    mutationFn: () => attendanceService.importCsv(file!),
    onSuccess: (r) => {
      setResult(r);
      onDone();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Import failed'),
  });

  return (
    <Modal open onClose={onClose} title="Import biometric CSV" footer={result ? <Button onClick={onClose}>Done</Button> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!file} loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Import</Button></>}>
      <div className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {result ? (
          <div className="space-y-2 text-sm">
            <p className="rounded-lg bg-green-50 px-3 py-2 font-medium text-green-800">
              Imported {result.processed} punches across {result.days} staff-days from {result.rows} rows.
            </p>
            {result.unknownDeviceIds.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                Unmatched device IDs: {result.unknownDeviceIds.join(', ')}. Set these as the biometric user ID on the staff records to include them next time.
              </p>
            )}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
              <Upload className="size-6 text-muted" />
              <span className="text-sm font-semibold">{file ? file.name : 'Choose the device export (.csv)'}</span>
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted">Accepted columns: deviceUserId (or userid / EmpCode), timestamp (or time / PunchTime), optional branchCode and direction. Punches are matched to staff by their biometric user ID.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function ManualEntryModal({ staff, date, onClose }: { staff: { staffId: string; fullName: string }; date: string; onClose: () => void }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState('Present');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => attendanceService.manual({ staffId: staff.staffId, branchId: branchId ?? user?.defaultBranchId, date, checkIn: checkIn || undefined, checkOut: checkOut || undefined, status, remarks: remarks || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance-day'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save'),
  });

  return (
    <Modal open onClose={onClose} title={`${staff.fullName} — ${fmtDate(date)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Save</Button></>}>
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check-out">
            <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Status" required>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {ATTENDANCE_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Remarks">
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">Manual entries override the biometric record for this day.</p>
      </div>
    </Modal>
  );
}
