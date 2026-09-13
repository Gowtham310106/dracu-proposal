'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { computePackageTotal, defaultValuesFor, PACKAGE_FORM, packageInput, type TreatmentPackage } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Button, ErrorNote, Modal, Select } from '@/components/ui';
import { branchService, packageService, staffService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { inr, today } from '@/lib/format';

export function PackageFormModal({ open, onClose, patientId, patientLabel, onCreated }: { open: boolean; onClose: () => void; patientId: string; patientLabel: string; onCreated?: (pkg: TreatmentPackage) => void }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: staffService.doctors, enabled: open });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list, enabled: open });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(packageInput),
    defaultValues: { ...defaultValuesFor(PACKAGE_FORM), patientId, branchId: branchId ?? user?.defaultBranchId ?? '', startDate: today(), totalSessions: 10, pricingMode: 'Package', discount: 0, status: 'Active' },
  });

  const values = form.watch();
  const preview = computePackageTotal({
    pricingMode: String(values.pricingMode ?? 'Package'),
    totalSessions: Number(values.totalSessions) || 0,
    perSessionFee: Number(values.perSessionFee) || 0,
    packageFee: Number(values.packageFee) || 0,
    discount: Number(values.discount) || 0,
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => packageService.create(body),
    onSuccess: (pkg) => {
      void qc.invalidateQueries({ queryKey: ['packages'] });
      void qc.invalidateQueries({ queryKey: ['patient', patientId] });
      void qc.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      onCreated?.(pkg);
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not create the package'),
  });

  const submit = form.handleSubmit((v) => {
    setServerError('');
    mutation.mutate(v);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`New treatment package — ${patientLabel}`}
      footer={
        <>
          <span className="mr-auto text-sm font-semibold">Total payable: {inr(preview)}</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={mutation.isPending}>
            Create package
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={PACKAGE_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          hidden={['patientId', ...(branches.length <= 1 ? ['branchId'] : [])]}
          computedValues={{ totalPayable: inr(preview), balance: inr(preview) }}
          slots={{
            assignedDoctorId: () => (
              <Select {...form.register('assignedDoctorId')}>
                <option value="">Unassigned</option>
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
          }}
        />
      </div>
    </Modal>
  );
}
