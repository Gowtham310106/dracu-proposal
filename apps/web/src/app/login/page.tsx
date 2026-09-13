'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginInput, type LoginInput } from '@acuheal/types';
import { useAuth } from '@/context/AuthContext';
import { Button, ErrorNote, Field, Input, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    if (ready && user) router.replace(user.role === 'DOCTOR' ? '/doctor' : '/dashboard');
  }, [ready, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await login(values.email, values.password);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not sign in. Check your connection and try again.');
    }
  });

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <section className="hidden flex-1 flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        {/* The logo artwork sits on a white ground, so it gets its own white chip rather than a filter. */}
        <span className="inline-flex w-fit rounded-xl bg-white px-4 py-3">
          <Image src="/brand/logo.png" alt="Dr. Bharath's Acu Heal" width={240} height={80} priority />
        </span>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold">One system for all three branches.</h2>
          <p className="mt-3 text-sm text-brand-100">Patients, appointments, acupuncture session packages, billing, enquiries, attendance and accounts — with branch-level isolation and a consolidated view for management.</p>
          <ul className="mt-6 space-y-2 text-sm text-brand-100">
            {['Session meters on every treatment package', 'Branch-prefixed patient IDs and invoice numbers', 'WhatsApp session reminders and birthday wishes', 'Progress video archive with a live storage meter'].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-point-yellow" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Software by BUILD FAST WEB</p>
      </section>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Image src="/brand/logo.png" alt="Dr. Bharath's Acu Heal" width={220} height={74} priority className="mx-auto mb-8 lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the credentials issued by your administrator.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {serverError && <ErrorNote>{serverError}</ErrorNote>}
            <Field label="Email" required error={errors.email?.message}>
              <Input type="email" autoComplete="username" autoFocus placeholder="you@acuheal.local" {...register('email')} />
            </Field>
            <Field label="Password" required error={errors.password?.message}>
              <Input type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted">Trouble signing in? Contact the clinic administrator on +91 97895 02278.</p>
        </div>
      </section>
    </main>
  );
}
