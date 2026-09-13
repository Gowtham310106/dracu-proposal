'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardPlus, Phone } from 'lucide-react';
import type { Appointment } from '@acuheal/types';
import { Badge, Button, EmptyState, PageHeader, SessionMeter, statusTone } from '@/components/ui';
import { SessionLogModal } from '@/components/SessionLogModal';
import { appointmentService } from '@/services';
import { fmtDate, fmtTime, initials, mobileDisplay, today } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SectionLoader } from '@/components/BrandLoader';

export default function DoctorQueuePage() {
  const qc = useQueryClient();
  const [logFor, setLogFor] = useState<Appointment | null>(null);
  const { data: queue = [], isLoading } = useQuery({ queryKey: ['queue', 'today'], queryFn: appointmentService.todayQueue, refetchInterval: 60_000 });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentService.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['queue'] }),
  });

  return (
    <>
      <PageHeader title="Today's queue" subtitle={fmtDate(today())} actions={<Link href="/appointments"><Button variant="secondary">Full directory</Button></Link>} />

      {isLoading ? (
        <SectionLoader />
      ) : queue.length === 0 ? (
        <div className="card">
          <EmptyState title="No patients in the queue" hint="Appointments booked for today will appear here as the front desk checks patients in." />
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((a) => {
            const flags = a.patient?.contraindicationFlags ?? [];
            return (
              <li key={a._id} className={cn('card p-4', a.status === 'In-treatment' && 'ring-2 ring-brand-200')}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{initials(a.patient?.fullName)}</span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/patients/${a.patientId}`} className="truncate text-base font-semibold hover:text-brand-700 hover:underline">
                        {a.patient?.fullName ?? 'Patient'}
                      </Link>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      <Badge tone="stone">{a.type}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {fmtTime(a.slotStart)} – {fmtTime(a.slotEnd)} · {a.patient?.pid} · <a href={`tel:+91${a.patient?.mobile}`} className="hover:text-brand-700">{mobileDisplay(a.patient?.mobile)}</a>
                    </p>
                    {a.reason && <p className="mt-1 text-sm text-gray-700">{a.reason}</p>}
                    {flags.length > 0 && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-point-red">
                        <AlertTriangle className="size-3.5" />
                        {flags.join(' · ')}
                      </p>
                    )}
                  </div>

                  {a.package && (
                    <div className="w-full sm:w-44">
                      <SessionMeter completed={a.package.sessionsCompleted} total={a.package.totalSessions} />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {a.status === 'Booked' && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: a._id, status: 'Checked-in' })}>
                      Check in
                    </Button>
                  )}
                  {(a.status === 'Checked-in' || a.status === 'Booked') && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: a._id, status: 'In-treatment' })}>
                      Start treatment
                    </Button>
                  )}
                  {a.package && a.status !== 'Completed' && (
                    <Button size="sm" icon={<ClipboardPlus className="size-4" />} onClick={() => setLogFor(a)}>
                      Log session
                    </Button>
                  )}
                  {a.status !== 'Completed' && !a.package && (
                    <Button size="sm" variant="success" onClick={() => setStatus.mutate({ id: a._id, status: 'Completed' })}>
                      Mark completed
                    </Button>
                  )}
                  <a href={`tel:+91${a.patient?.mobile}`} className="ml-auto">
                    <Button size="sm" variant="ghost" icon={<Phone className="size-4" />}>
                      Call
                    </Button>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {logFor?.package && (
        <SessionLogModal
          open
          onClose={() => setLogFor(null)}
          packageId={logFor.package._id}
          packageLabel={logFor.package.customPlanName || logFor.package.treatmentPlanName}
          completed={logFor.package.sessionsCompleted}
          total={logFor.package.totalSessions}
          appointmentId={logFor._id}
        />
      )}
    </>
  );
}
