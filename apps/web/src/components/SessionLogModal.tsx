'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultValuesFor, SESSION_LOG_FORM, sessionLogInput } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Button, ErrorNote, Modal, Select, SessionMeter } from '@/components/ui';
import { packageService, staffService } from '@/services';
import { ApiError } from '@/lib/api';
import { today } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';

/** Bedside form: logs one acupuncture session and advances the package meter. */
export function SessionLogModal({ open, onClose, packageId, packageLabel, completed, total, appointmentId, onLogged }: { open: boolean; onClose: () => void; packageId: string; packageLabel: string; completed: number; total: number; appointmentId?: string; onLogged?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: staffService.doctors, enabled: open });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(sessionLogInput),
    defaultValues: { ...defaultValuesFor(SESSION_LOG_FORM), date: today(), doctorId: user?.role === 'DOCTOR' ? user._id : '', appointmentId },
  });

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => packageService.logSession(packageId, { ...values, appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['package', packageId] });
      void qc.invalidateQueries({ queryKey: ['packages'] });
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: ['queue'] });
      form.reset({ ...defaultValuesFor(SESSION_LOG_FORM), date: today(), doctorId: user?.role === 'DOCTOR' ? user._id : '' });
      onLogged?.();
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the session'),
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
      title={`Log session ${completed + 1} of ${total} — ${packageLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={mutation.isPending}>
            Save session
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SessionMeter completed={completed} total={total} />
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={SESSION_LOG_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          computedValues={{ sessionNumber: completed + 1 }}
          slots={{
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
          }}
        />
      </div>
    </Modal>
  );
}
