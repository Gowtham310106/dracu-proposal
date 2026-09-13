'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';

export default function Home() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? (user.role === 'DOCTOR' ? '/doctor' : '/dashboard') : '/login');
  }, [ready, user, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-7" />
    </main>
  );
}
