'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui';
import { PatientForm } from '@/components/PatientForm';
import { patientService } from '@/services';

export default function NewPatientPage() {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <>
      <PageHeader title="Register patient" subtitle="The mobile number is checked against every branch as you type." />
      <PatientForm
        submitLabel="Register patient"
        onSubmit={async (values) => {
          const patient = await patientService.create(values);
          await qc.invalidateQueries({ queryKey: ['patients'] });
          router.replace(`/patients/${patient._id}`);
        }}
      />
    </>
  );
}
