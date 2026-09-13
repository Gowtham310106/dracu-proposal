'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { resolver, toDefaults } from '@/lib/form';
import { useQuery } from '@tanstack/react-query';
import { Camera, UserCheck, X } from 'lucide-react';
import Webcam from 'react-webcam';
import { defaultValuesFor, PATIENT_FORM, patientInput, type Patient } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Button, ErrorNote, Modal, Select } from '@/components/ui';
import { branchService, patientService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { useDebounced } from '@/lib/useDebounced';
import { fmtDate } from '@/lib/format';

export interface PatientFormProps {
  /** Existing patient to edit, or prefill values when converting a lead. */
  initial?: Partial<Patient>;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  /** Disable the duplicate lookup when editing an existing record. */
  checkDuplicates?: boolean;
}

export function PatientForm({ initial, submitLabel, onSubmit, checkDuplicates = true }: PatientFormProps) {
  const { branchId, user } = useAuth();
  const [serverError, setServerError] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(patientInput),
    defaultValues: {
      ...defaultValuesFor(PATIENT_FORM),
      branchId: initial?.branchId ?? branchId ?? user?.defaultBranchId ?? '',
      ...toDefaults(initial),
      dateOfBirth: initial?.dateOfBirth ? String(initial.dateOfBirth).slice(0, 10) : '',
    },
  });

  const mobile = String(form.watch('mobile') ?? '');
  const debouncedMobile = useDebounced(mobile, 450);
  const photoUrl = String(form.watch('photoUrl') ?? '');

  const { data: duplicates = [] } = useQuery({
    queryKey: ['patient-lookup', debouncedMobile],
    queryFn: () => patientService.lookup(debouncedMobile),
    enabled: checkDuplicates && /^[6-9]\d{9}$/.test(debouncedMobile),
  });

  useEffect(() => setDupDismissed(false), [debouncedMobile]);

  const capture = () => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) form.setValue('photoUrl', shot, { shouldDirty: true });
    setCamOpen(false);
  };

  /** Copies an existing patient's details into the form (front desk auto-fill). */
  const autofillFrom = (p: Patient) => {
    for (const key of ['fullName', 'gender', 'email', 'addressLine', 'area', 'city', 'state', 'pincode', 'preferredLanguage', 'referralSource'] as const) {
      const v = (p as unknown as Record<string, unknown>)[key];
      if (v) form.setValue(key, v as string, { shouldDirty: true });
    }
    if (p.dateOfBirth) form.setValue('dateOfBirth', String(p.dateOfBirth).slice(0, 10), { shouldDirty: true });
    setDupDismissed(true);
  };

  const submit = form.handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
        for (const [path, message] of Object.entries(err.fieldErrors)) form.setError(path as never, { message });
      } else setServerError('Could not save. Check your connection and try again.');
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 pb-24" noValidate>
      {serverError && <ErrorNote>{serverError}</ErrorNote>}

      {checkDuplicates && duplicates.length > 0 && !dupDismissed && (
        <div className="card border-point-yellow bg-amber-50/70 p-4">
          <div className="flex items-start gap-2">
            <UserCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">This mobile number is already registered</p>
              <ul className="mt-2 space-y-1.5">
                {duplicates.map((d) => (
                  <li key={d._id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="font-semibold">{d.fullName}</span>
                    <span className="text-xs text-muted">
                      {d.pid} · {d.branch?.code ?? '—'} · registered {fmtDate(d.createdAt)}
                    </span>
                    <span className="ml-auto flex gap-2">
                      <Link href={`/patients/${d._id}`}>
                        <Button size="sm" variant="secondary" type="button">
                          Open record
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" type="button" onClick={() => autofillFrom(d)}>
                        Auto-fill from this
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={() => setDupDismissed(true)} className="rounded p-1 text-amber-700 hover:bg-amber-100" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <FormRenderer
        definition={PATIENT_FORM}
        control={form.control}
        errors={form.formState.errors}
        watch={form.watch}
        computedValues={{ pid: initial?.pid }}
        slots={{
          photo: () => (
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Patient" className="size-16 rounded-lg border border-line object-cover" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">No photo</div>
              )}
              <div className="flex flex-col gap-1.5">
                <Button type="button" size="sm" variant="secondary" icon={<Camera className="size-4" />} onClick={() => setCamOpen(true)}>
                  {photoUrl ? 'Retake' : 'Capture'}
                </Button>
                {photoUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => form.setValue('photoUrl', '')}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ),
        }}
        hidden={branches.length <= 1 ? ['branchId'] : []}
      />

      {branches.length > 1 && (
        <div className="card p-4">
          <label className="field-label" htmlFor="branchId">
            Branch<span className="ml-0.5 text-point-red">*</span>
          </label>
          <Select id="branchId" {...form.register('branchId')} className="max-w-sm">
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">Determines the patient ID prefix and which branch owns this record.</p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:pl-68">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => history.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>

      <Modal open={camOpen} onClose={() => setCamOpen(false)} title="Capture patient photo" footer={<><Button variant="secondary" onClick={() => setCamOpen(false)}>Cancel</Button><Button onClick={capture}>Capture</Button></>}>
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} className="w-full rounded-lg" />
        <p className="mt-2 text-xs text-muted">Allow camera access when your browser asks. The photo is stored with the patient record.</p>
      </Modal>
    </form>
  );
}
