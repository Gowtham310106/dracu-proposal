'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { APPOINTMENT_FORM, appointmentInput, defaultValuesFor } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Button, ErrorNote, Modal, SearchPicker, Select } from '@/components/ui';
import { appointmentService, branchService, packageService, patientService, staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

export function AppointmentFormModal({ open, onClose, date, presetPatientId }: { open: boolean; onClose: () => void; date: string; presetPatientId?: string }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [patientLabel, setPatientLabel] = useState('');

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: staffService.doctors, enabled: open });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list, enabled: open });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(appointmentInput),
    defaultValues: { ...defaultValuesFor(APPOINTMENT_FORM), branchId: branchId ?? user?.defaultBranchId ?? '', date, slotStart: '10:00', slotEnd: '10:30', type: 'Consultation', status: 'Booked', patientId: presetPatientId ?? '' },
  });

  const patientId = String(form.watch('patientId') ?? '');
  const slotStart = String(form.watch('slotStart') ?? '');
  const type = String(form.watch('type') ?? '');

  // keep the end slot 30 minutes after the start unless the user edits it
  useEffect(() => {
    if (!slotStart) return;
    const end = dayjs(`2000-01-01T${slotStart}`).add(30, 'minute').format('HH:mm');
    form.setValue('slotEnd', end);
  }, [slotStart, form]);

  useEffect(() => {
    if (!presetPatientId) return;
    void patientService.get(presetPatientId).then((p) => setPatientLabel(`${p.fullName} (${p.pid})`));
  }, [presetPatientId]);

  const { data: packages } = useQuery({
    queryKey: ['patient-packages', patientId],
    queryFn: () => packageService.list({ patientId, status: 'Active', limit: 20 }),
    enabled: open && !!patientId && type === 'Session',
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => appointmentService.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: ['queue'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not book the appointment'),
  });

  const submit = form.handleSubmit((values) => {
    setServerError('');
    mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Book appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={mutation.isPending}>
            Book
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={APPOINTMENT_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          hidden={branches.length <= 1 ? ['branchId'] : []}
          slots={{
            patientId: () => (
              <SearchPicker
                value={patientId}
                valueLabel={patientLabel}
                onChange={(id, opt) => {
                  form.setValue('patientId', id ?? '');
                  setPatientLabel(opt?.label ?? '');
                }}
                search={async (q) => (await patientService.search(q)).map((p) => ({ _id: p._id, label: p.fullName, sub: `${p.pid} · +91 ${p.mobile}` }))}
                placeholder="Search name, PID or mobile…"
              />
            ),
            doctorId: () => (
              <Select {...form.register('doctorId')}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.fullName}
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
            treatmentPackageId: () => (
              <Select {...form.register('treatmentPackageId')}>
                <option value="">No package</option>
                {(packages?.items ?? []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.customPlanName || p.treatmentPlanName} — session {p.sessionsCompleted + 1} of {p.totalSessions}
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
