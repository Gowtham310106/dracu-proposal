'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BrandLoader } from '@/components/BrandLoader';

export default function Home() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? (user.role === 'DOCTOR' ? '/doctor' : '/dashboard') : '/login');
  }, [ready, user, router]);

  return (
    <main><BrandLoader label="Opening Acu Heal…" /></main>
  );
}
