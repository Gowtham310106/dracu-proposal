'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Film, Layers, Pencil, Phone, ReceiptIndianRupee } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SessionMeter, Tabs, statusTone } from '@/components/ui';
import { PatientForm } from '@/components/PatientForm';
import { PackageFormModal } from '@/components/PackageFormModal';
import { MediaUploadModal } from '@/components/MediaUploadModal';
import { patientService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { fmtDate, fmtDateTime, initials, inr, mobileDisplay, relative } from '@/lib/format';
import { SectionLoader } from '@/components/BrandLoader';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'packages', label: 'Packages & sessions' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'media', label: 'Media' },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [newPackage, setNewPackage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: patient, isLoading } = useQuery({ queryKey: ['patient', id], queryFn: () => patientService.get(id) });
  const { data: timeline } = useQuery({ queryKey: ['patient-timeline', id], queryFn: () => patientService.timeline(id), enabled: tab === 'timeline' || tab === 'packages' || tab === 'media' });

  const update = useMutation({
    mutationFn: (values: Record<string, unknown>) => patientService.update(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patient', id] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
      setEditing(false);
    },
  });

  if (isLoading || !patient) {
    return (
      <SectionLoader />
    );
  }

  const flags = patient.contraindicationFlags ?? [];
  const mediaEvents = timeline?.events.filter((e) => e.kind === 'media') ?? [];

  return (
    <>
      <PageHeader
        backHref="/patients"
        backLabel="Patients"
        title={patient.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">{patient.pid}</span>
            <span>·</span>
            <a href={`tel:+91${patient.mobile}`} className="hover:text-brand-700">
              {mobileDisplay(patient.mobile)}
            </a>
            <span>·</span>
            <span>
              {patient.gender}
              {patient.age ? `, ${patient.age}y` : ''}
            </span>
            <Badge tone={statusTone(patient.status)}>{patient.status}</Badge>
          </span>
        }
        actions={
          <>
            <a href={`tel:+91${patient.mobile}`}>
              <Button variant="secondary" icon={<Phone className="size-4" />}>
                Call
              </Button>
            </a>
            {can('appointments:write') && (
              <Link href={`/appointments?patientId=${patient._id}&book=1`}>
                <Button variant="secondary" icon={<CalendarPlus className="size-4" />}>
                  Book
                </Button>
              </Link>
            )}
            {can('billing:write') && (
              <Link href={`/billing/new?patientId=${patient._id}`}>
                <Button variant="secondary" icon={<ReceiptIndianRupee className="size-4" />}>
                  Invoice
                </Button>
              </Link>
            )}
            {can('patients:write') && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      {flags.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-point-red" />
          <div className="text-sm">
            <span className="font-semibold text-point-red">Contraindications: </span>
            <span className="text-red-800">{flags.join(' · ')}</span>
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-3">
          {patient.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patient.photoUrl} alt={patient.fullName} className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{initials(patient.fullName)}</span>
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted">Last visit</p>
            <p className="truncate text-sm font-semibold">{patient.lastVisitAt ? relative(patient.lastVisitAt) : 'No visits yet'}</p>
          </div>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Package balance</p>
          <p className="text-lg font-bold">{inr(patient.totals.packageDue)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Invoice balance</p>
          <p className="text-lg font-bold">{inr(patient.totals.invoiceDue)}</p>
        </div>
        <div className="card p-3">
          {patient.activePackage ? (
            <Link href={`/packages/${patient.activePackage._id}`} className="block">
              <p className="text-xs text-muted">Active package</p>
              <SessionMeter completed={patient.activePackage.sessionsCompleted} total={patient.activePackage.totalSessions} className="mt-1" />
            </Link>
          ) : (
            <>
              <p className="text-xs text-muted">No active package</p>
              {can('packages:write') && (
                <Button size="sm" variant="secondary" className="mt-1.5" icon={<Layers className="size-4" />} onClick={() => setNewPackage(true)}>
                  Start package
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-4">
        {tab === 'profile' && <ProfileTab patient={patient} />}

        {tab === 'packages' && (
          <Card title="Treatment packages" action={can('packages:write') && <Button size="sm" onClick={() => setNewPackage(true)}>New package</Button>}>
            {(timeline?.packages.length ?? 0) === 0 ? (
              <EmptyState title="No treatment packages yet" hint="Create a package to track sessions, fees and balance for this patient." />
            ) : (
              <ul className="space-y-2">
                {timeline?.packages.map((p) => (
                  <li key={p._id}>
                    <Link href={`/packages/${p._id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-brand-50/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.customPlanName || p.treatmentPlanName}</p>
                        <p className="text-xs text-muted">
                          {p.packageNo} · started {fmtDate(p.startDate)} · {inr(p.totalPayable)} total
                        </p>
                      </div>
                      <SessionMeter completed={p.sessionsCompleted} total={p.totalSessions} />
                      <div className="text-right">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        <p className="mt-1 text-xs font-semibold text-muted">Balance {inr(p.balance)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'timeline' && (
          <Card title="Full history">
            {(timeline?.events.length ?? 0) === 0 ? (
              <EmptyState title="Nothing recorded yet" hint="Appointments, sessions, invoices, payments and media all appear here." />
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-5">
                {timeline?.events.map((e) => (
                  <li key={`${e.kind}-${e.id}`} className="relative">
                    <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-white bg-brand-500" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="stone">{e.kind}</Badge>
                      <span className="text-sm font-semibold">{e.title}</span>
                      {e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}
                      <span className="ml-auto text-xs text-muted">{fmtDateTime(e.at)}</span>
                    </div>
                    {e.kind === 'session' && e.meta?.observations ? <p className="mt-1 text-sm text-gray-700">{String(e.meta.observations)}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

        {tab === 'media' && (
          <Card title="Progress media" action={can('media:write') && <Button size="sm" icon={<Film className="size-4" />} onClick={() => setUploading(true)}>Upload</Button>}>
            {mediaEvents.length === 0 ? (
              <EmptyState title="No photos or videos yet" hint="Upload treatment progress videos (up to 15 MB) or photos for this patient." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mediaEvents.map((m) => {
                  const url = String(m.meta?.url ?? '');
                  const isVideo = String(m.meta?.mimeType ?? '').startsWith('video/');
                  return (
                    <li key={m.id} className="card overflow-hidden">
                      {isVideo ? <video src={url} controls className="aspect-video w-full bg-black object-contain" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={m.title} className="aspect-video w-full object-cover" />}
                      <div className="p-2.5">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted">{fmtDate(m.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${patient.fullName}`} wide>
        <PatientForm initial={patient} checkDuplicates={false} submitLabel="Save changes" onSubmit={async (values) => void (await update.mutateAsync(values))} />
      </Modal>

      {newPackage && (
        <PackageFormModal
          open
          onClose={() => setNewPackage(false)}
          patientId={patient._id}
          patientLabel={`${patient.fullName} (${patient.pid})`}
          onCreated={(pkg) => router.push(`/packages/${pkg._id}`)}
        />
      )}

      {uploading && <MediaUploadModal open onClose={() => setUploading(false)} patientId={patient._id} patientLabel={patient.fullName} onUploaded={() => void qc.invalidateQueries({ queryKey: ['patient-timeline', id] })} />}
    </>
  );
}

function ProfileTab({ patient }: { patient: Awaited<ReturnType<typeof patientService.get>> }) {
  const rows: [string, React.ReactNode][] = [
    ['Chief complaint', patient.chiefComplaint],
    ['Duration', patient.complaintDurationValue ? `${patient.complaintDurationValue} ${patient.complaintDurationUnit}` : '—'],
    ['Pain scale', patient.painScale != null ? `${patient.painScale} / 10` : '—'],
    ['Conditions', patient.conditions?.length ? patient.conditions.join(', ') : '—'],
    ['Affected regions', patient.affectedRegions?.length ? patient.affectedRegions.join(', ') : '—'],
    ['Diagnosis notes', patient.diagnosisNotes || '—'],
    ['Previous treatments', patient.previousTreatments?.length ? patient.previousTreatments.join(', ') : '—'],
    ['Medical history', patient.medicalHistory?.length ? patient.medicalHistory.join(', ') : '—'],
    ['Current medications', patient.currentMedications || '—'],
    ['Allergies', patient.allergies || '—'],
    ['Lifestyle', patient.lifestyle || '—'],
    ['Sleep quality', patient.sleepQuality || '—'],
  ];
  const admin: [string, React.ReactNode][] = [
    ['Date of birth', patient.dateOfBirth ? fmtDate(patient.dateOfBirth) : '—'],
    ['Blood group', patient.bloodGroup || '—'],
    ['Email', patient.email || '—'],
    ['Alternate mobile', patient.altMobile ? mobileDisplay(patient.altMobile) : '—'],
    ['Address', [patient.addressLine, patient.area, patient.city, patient.state, patient.pincode].filter(Boolean).join(', ') || '—'],
    ['Emergency contact', patient.emergencyContactName ? `${patient.emergencyContactName} · ${mobileDisplay(patient.emergencyContactMobile)}` : '—'],
    ['Preferred language', patient.preferredLanguage || '—'],
    ['WhatsApp reminders', patient.whatsappOptIn ? 'Opted in' : 'Opted out'],
    ['Referral source', patient.referredBy ? `${patient.referralSource} — ${patient.referredBy}` : patient.referralSource],
    ['Consent', patient.consentGiven ? `Recorded ${patient.consentSignedAt ? fmtDate(patient.consentSignedAt) : ''}` : 'Not recorded'],
    ['Tags', patient.tags?.length ? patient.tags.join(', ') : '—'],
    ['Notes', patient.notes || '—'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Acupuncture intake">
        <dl className="space-y-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="col-span-2 font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Contact & admin">
        <dl className="space-y-2.5">
          {admin.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="col-span-2 font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
