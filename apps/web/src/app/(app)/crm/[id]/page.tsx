'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, UserPlus } from 'lucide-react';
import { defaultValuesFor, FOLLOW_UP_FORM, followUpInput } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { PatientForm } from '@/components/PatientForm';
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, PageHeader, Spinner, statusTone } from '@/components/ui';
import { leadService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDateTime, mobileDisplay, relative } from '@/lib/format';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [converting, setConverting] = useState(false);
  const [serverError, setServerError] = useState('');

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => leadService.get(id) });

  const form = useForm<Record<string, unknown>>({ resolver: resolver(followUpInput), defaultValues: { ...defaultValuesFor(FOLLOW_UP_FORM), channel: 'Call' } });

  const addFollowUp = useMutation({
    mutationFn: (values: Record<string, unknown>) => leadService.addFollowUp(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lead', id] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      form.reset({ ...defaultValuesFor(FOLLOW_UP_FORM), channel: 'Call' });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the follow-up'),
  });

  if (isLoading || !lead) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{lead.leadNo}</span>
            <a href={`tel:+91${lead.mobile}`} className="hover:text-brand-700">
              {mobileDisplay(lead.mobile)}
            </a>
            <Badge tone={statusTone(lead.status)}>{lead.status}</Badge>
            <Badge tone="stone">{lead.source}</Badge>
          </span>
        }
        actions={
          <>
            <a href={`tel:+91${lead.mobile}`}>
              <Button variant="secondary" icon={<Phone className="size-4" />}>
                Call
              </Button>
            </a>
            {lead.convertedPatientId ? (
              <Link href={`/patients/${lead.convertedPatientId}`}>
                <Button variant="secondary">Open patient record</Button>
              </Link>
            ) : (
              can('crm:write') &&
              can('patients:write') && (
                <Button icon={<UserPlus className="size-4" />} onClick={() => setConverting(true)}>
                  Convert to patient
                </Button>
              )
            )}
          </>
        }
      />

      {lead.existingPatientId && !lead.convertedPatientId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
          This mobile number already belongs to a registered patient.{' '}
          <Link href={`/patients/${lead.existingPatientId}`} className="font-semibold text-brand-700 hover:underline">
            Open that record
          </Link>
          .
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card title={`Follow-ups (${lead.followUps.length})`} bodyClass="p-0">
          {lead.followUps.length === 0 ? (
            <EmptyState title="No follow-ups recorded" hint="Log every call or WhatsApp message so the next person knows where this enquiry stands." />
          ) : (
            <ol className="divide-y divide-line">
              {[...lead.followUps].reverse().map((f) => (
                <li key={f._id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{f.channel}</Badge>
                    <span className="text-sm font-semibold">{f.outcome}</span>
                    <span className="ml-auto text-xs text-muted">{fmtDateTime(f.at)}</span>
                  </div>
                  {f.note && <p className="mt-1 text-sm text-gray-700">{f.note}</p>}
                  <p className="mt-0.5 text-xs text-muted">by {f.byName ?? '—'}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Enquiry details">
            <dl className="space-y-2 text-sm">
              {[
                ['Interested in', lead.interestedIn || '—'],
                ['Campaign', lead.campaign || '—'],
                ['Assigned to', lead.assignedToName ?? (lead as { assignee?: { fullName: string } }).assignee?.fullName ?? 'Unassigned'],
                ['Next follow-up', lead.nextFollowUpAt ? relative(lead.nextFollowUpAt) : '—'],
                ['Complaint', lead.complaintSummary || '—'],
                ...(lead.lostReason ? [['Lost reason', lead.lostReason] as [string, string]] : []),
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-2 gap-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {can('crm:write') && lead.status !== 'Converted' && (
            <Card title="Add follow-up">
              {serverError && <ErrorNote>{serverError}</ErrorNote>}
              <FormRenderer definition={FOLLOW_UP_FORM} control={form.control} errors={form.formState.errors} watch={form.watch} />
              <Button className="mt-3 w-full" loading={addFollowUp.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); addFollowUp.mutate(v); })()}>
                Save follow-up
              </Button>
            </Card>
          )}
        </div>
      </div>

      <Modal open={converting} onClose={() => setConverting(false)} title={`Convert ${lead.name} to a patient`} wide>
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">Details from the enquiry are pre-filled. Complete the clinical intake to finish registration.</p>
        <PatientForm
          checkDuplicates={false}
          submitLabel="Convert & register"
          initial={{ fullName: lead.name, mobile: lead.mobile, branchId: lead.branchId, chiefComplaint: lead.complaintSummary ?? '', referralSource: (lead.source === 'Website' ? 'Website' : lead.source) as never }}
          onSubmit={async (values) => {
            const result = await leadService.convert(id, values);
            await qc.invalidateQueries({ queryKey: ['leads'] });
            router.push(`/patients/${result.patient._id}`);
          }}
        />
      </Modal>
    </>
  );
}
