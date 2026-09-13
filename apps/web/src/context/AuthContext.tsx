'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hasPermission, type AuthUser, type Permission } from '@acuheal/types';
import { api, auth } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  branchId: string | null;
  /** null means "all branches" (admin / accounts only) */
  setBranchId: (id: string | null) => void;
  canSwitchBranch: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (needed: Permission | Permission[]) => boolean;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const BRANCH_KEY = 'acuheal.branch';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const applyUser = useCallback((u: AuthUser | null) => {
    setUser(u);
    if (!u) {
      auth.setBranch(null);
      setBranchIdState(null);
      return;
    }
    const canSwitch = u.permissions.includes('branches:all');
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(BRANCH_KEY) : null;
    const next = canSwitch ? (stored && (stored === 'all' ? null : u.branchIds.includes(stored) ? stored : u.defaultBranchId)) ?? (stored === 'all' ? null : u.defaultBranchId) : u.defaultBranchId;
    setBranchIdState(next);
    auth.setBranch(next ?? 'all');
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      if (await api.refresh()) {
        const { data } = await api.get<AuthUser>('/auth/me');
        applyUser(data);
      }
    } catch {
      applyUser(null);
    } finally {
      setReady(true);
    }
  }, [applyUser]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    auth.onUnauthorized(() => {
      auth.setToken(null);
      setUser(null);
      if (pathname !== '/login') router.replace('/login');
    });
    return () => auth.onUnauthorized(null);
  }, [router, pathname]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password });
      auth.setToken(data.accessToken);
      applyUser(data.user);
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    auth.setToken(null);
    applyUser(null);
    router.replace('/login');
  }, [applyUser, router]);

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id);
    auth.setBranch(id ?? 'all');
    window.localStorage.setItem(BRANCH_KEY, id ?? 'all');
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<AuthUser>('/auth/me');
    setUser(data);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      branchId,
      setBranchId,
      canSwitchBranch: !!user?.permissions.includes('branches:all'),
      login,
      logout,
      can: (needed) => hasPermission(user?.permissions, needed),
      refreshUser,
    }),
    [user, ready, branchId, setBranchId, login, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
