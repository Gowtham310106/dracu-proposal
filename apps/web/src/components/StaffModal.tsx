'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultValuesFor, STAFF_FORM, staffInput, type Staff } from '@acuheal/types';
import { Camera } from 'lucide-react';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { PhotoCapture } from '@/components/PhotoCapture';
import { Button, ErrorNote, Input, Modal, MultiSelect, Select } from '@/components/ui';
import { branchService, staffService } from '@/services';
import { ApiError } from '@/lib/api';

export function StaffModal({ staff, onClose }: { staff?: Staff; onClose: () => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(staffInput),
    defaultValues: staff
      ? { ...defaultValuesFor(STAFF_FORM), ...staff, password: '', joiningDate: staff.joiningDate ? String(staff.joiningDate).slice(0, 10) : '' }
      : { ...defaultValuesFor(STAFF_FORM), role: 'FRONT_DESK', active: true, branchIds: [], salary: { basic: 0, allowances: 0, deductions: 0, payCycle: 'Monthly' } },
  });

  const branchIds = (form.watch('branchIds') as string[]) ?? [];

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => (staff ? staffService.update(staff._id, values) : staffService.create(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : 'Could not save the staff record');
      if (err instanceof ApiError) for (const [path, message] of Object.entries(err.fieldErrors)) form.setError(path as never, { message });
    },
  });

  return (
    <Modal open onClose={onClose} wide title={staff ? `Edit ${staff.fullName}` : 'Add staff'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>{staff ? 'Save changes' : 'Create staff'}</Button></>}>
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={STAFF_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          computedValues={{ employeeCode: staff?.employeeCode }}
          slots={{
            branchIds: () => <MultiSelect options={branches.map((b) => ({ value: b._id, label: b.name }))} value={branchIds} onChange={(v) => form.setValue('branchIds', v, { shouldValidate: true })} />,
            defaultBranchId: () => (
              <Select {...form.register('defaultBranchId')}>
                <option value="">Select branch…</option>
                {branches.filter((b) => branchIds.includes(b._id)).map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            ),
            password: () => <Input type="password" autoComplete="new-password" placeholder={staff ? 'Leave blank to keep unchanged' : 'Minimum 8 characters'} {...form.register('password')} />,
            photo: () => {
              const photoUrl = String(form.watch('photoUrl') ?? '');
              return (
                <div className="flex items-center gap-3">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="Staff" className="size-16 rounded-lg border border-line object-cover" />
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
              );
            },
          }}
        />
      </div>

      <PhotoCapture
        open={camOpen}
        onClose={() => setCamOpen(false)}
        title="Capture staff photo"
        onCapture={(dataUrl) => form.setValue('photoUrl', dataUrl, { shouldDirty: true })}
      />
    </Modal>
  );
}
