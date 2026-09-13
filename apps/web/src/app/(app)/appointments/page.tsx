'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import { APPOINTMENT_STATUS, type Appointment } from '@acuheal/types';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, SessionMeter, statusTone } from '@/components/ui';
import { AppointmentFormModal } from '@/components/AppointmentFormModal';
import { appointmentService, staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { fmtDate, fmtTime, mobileDisplay, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SectionLoader } from '@/components/BrandLoader';

export default function AppointmentsPage() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const { branchId, can } = useAuth();
  const [date, setDate] = useState(today());
  const [doctorId, setDoctorId] = useState('');
  const [booking, setBooking] = useState(params.get('book') === '1');
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['appointments', 'day', date, doctorId, branchId], queryFn: () => appointmentService.day(date, doctorId || undefined) });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: staffService.doctors });

  const setStatus = useMutation({
    mutationFn: ({ id, status, cancelReason }: { id: string; status: string; cancelReason?: string }) => appointmentService.setStatus(id, status, cancelReason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const shift = (days: number) => setDate(dayjs(date).add(days, 'day').format('YYYY-MM-DD'));
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${fmtDate(date)} · ${data?.branch.name ?? ''}`}
        actions={can('appointments:write') && <Button icon={<CalendarPlus className="size-4" />} onClick={() => setBooking(true)}>Book appointment</Button>}
      />

      <Card bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(today())}>
            Today
          </Button>
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="ml-auto w-48">
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {APPOINTMENT_STATUS.filter((s) => counts[s]).map((s) => (
            <Badge key={s} tone={statusTone(s)}>
              {s}: {counts[s]}
            </Badge>
          ))}
          {Object.keys(counts).length === 0 && <span className="text-xs text-muted">No appointments booked for this day.</span>}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card title="Day directory" bodyClass="p-0">
          {isLoading ? (
            <SectionLoader />
          ) : (data?.appointments.length ?? 0) === 0 ? (
            <EmptyState title="No appointments" hint="Book an appointment to fill this day." action={can('appointments:write') && <Button size="sm" onClick={() => setBooking(true)}>Book appointment</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {data?.appointments.map((a) => (
                <li key={a._id} className="p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-bold">{fmtTime(a.slotStart)}</p>
                      <p className="text-xs text-muted">{fmtTime(a.slotEnd)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/patients/${a.patientId}`} className="truncate font-semibold hover:text-brand-700 hover:underline">
                          {a.patient?.fullName}
                        </Link>
                        <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                        <Badge tone="stone">{a.type}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.patient?.pid} · {mobileDisplay(a.patient?.mobile)} · {a.doctor?.fullName}
                      </p>
                      {a.reason && <p className="mt-1 text-sm text-gray-700">{a.reason}</p>}
                    </div>
                    {a.package && <SessionMeter completed={a.package.sessionsCompleted} total={a.package.totalSessions} className="w-36" />}
                  </div>

                  {can('appointments:write') && !['Completed', 'Cancelled'].includes(a.status) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-0 sm:pl-23">
                      {a.status === 'Booked' && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: a._id, status: 'Checked-in' })}>
                          Check in
                        </Button>
                      )}
                      <Button size="sm" variant="success" onClick={() => setStatus.mutate({ id: a._id, status: 'Completed' })}>
                        Complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRescheduling(a)}>
                        Reschedule
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a._id, status: 'No-show' })}>
                        No-show
                      </Button>
                      <Button size="sm" variant="ghost" className="text-point-red" onClick={() => { const reason = prompt('Reason for cancellation?') ?? undefined; if (reason !== undefined) setStatus.mutate({ id: a._id, status: 'Cancelled', cancelReason: reason }); }}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Slots" bodyClass="p-3">
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
            {data?.slots.map((s) => (
              <div key={s.start} className={cn('rounded-lg border px-2 py-1.5 text-center text-xs font-semibold', s.booked === 0 ? 'border-line text-muted' : s.booked === 1 ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                {s.start}
                {s.booked > 0 && <span className="block text-[10px] font-medium">{s.booked} booked</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {booking && <AppointmentFormModal open onClose={() => setBooking(false)} date={date} presetPatientId={params.get('patientId') ?? undefined} />}
      {rescheduling && <RescheduleModal appointment={rescheduling} onClose={() => setRescheduling(null)} />}
    </>
  );
}

function RescheduleModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(appointment.date);
  const [slotStart, setSlotStart] = useState(appointment.slotStart);
  const [slotEnd, setSlotEnd] = useState(appointment.slotEnd);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => appointmentService.reschedule(appointment._id, { date, slotStart, slotEnd }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not reschedule'),
  });

  return (
    <Modal open onClose={onClose} title={`Reschedule — ${appointment.patient?.fullName}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Reschedule</Button></>}>
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-point-red">{error}</p>}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="field-label">Date</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">From</span>
            <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">To</span>
            <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted">The original slot is kept in the appointment history.</p>
      </div>
    </Modal>
  );
}
