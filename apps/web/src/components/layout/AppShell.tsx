'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, CalendarDays, Layers, ReceiptIndianRupee, Megaphone, MessageSquare,
  Fingerprint, Wallet, Truck, UserCog, Film, Settings, Stethoscope, LogOut, Menu, X, Building2, ChevronDown,
} from 'lucide-react';
import type { Permission } from '@acuheal/types';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  perm?: Permission;
  group: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:view', group: 'Overview' },
  { href: '/doctor', label: "Today's queue", icon: Stethoscope, perm: 'appointments:read', group: 'Overview' },

  { href: '/patients', label: 'Patients', icon: Users, perm: 'patients:read', group: 'Front desk' },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays, perm: 'appointments:read', group: 'Front desk' },
  { href: '/packages', label: 'Treatment packages', icon: Layers, perm: 'packages:read', group: 'Front desk' },
  { href: '/billing', label: 'Billing', icon: ReceiptIndianRupee, perm: 'billing:read', group: 'Front desk' },

  { href: '/crm', label: 'Enquiries (CRM)', icon: Megaphone, perm: 'crm:read', group: 'Growth' },
  { href: '/messaging', label: 'WhatsApp', icon: MessageSquare, perm: 'messaging:read', group: 'Growth' },
  { href: '/media', label: 'Media archive', icon: Film, perm: 'media:read', group: 'Growth' },

  { href: '/accounts', label: 'Accounts', icon: Wallet, perm: 'accounts:read', group: 'Operations' },
  { href: '/vendors', label: 'Vendors & purchases', icon: Truck, perm: 'accounts:read', group: 'Operations' },
  { href: '/attendance', label: 'Attendance', icon: Fingerprint, perm: 'attendance:read', group: 'Operations' },
  { href: '/staff', label: 'Staff', icon: UserCog, perm: 'staff:read', group: 'Operations' },

  { href: '/admin', label: 'Admin', icon: Settings, perm: 'admin:manage', group: 'Operations' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, can, logout, branchId, setBranchId, canSwitchBranch } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  useEffect(() => setNavOpen(false), [pathname]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const groups = [...new Set(items.map((i) => i.group))];
  const activeBranch = user.branches.find((b) => b._id === branchId);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:static lg:translate-x-0', navOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <Link href="/dashboard" className="flex items-center">
            <Image src="/brand/logo.png" alt="Dr. Bharath's Acu Heal" width={150} height={50} priority />
          </Link>
          <button onClick={() => setNavOpen(false)} className="rounded p-1 text-muted lg:hidden" aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              <p className="px-3 pb-1 text-[10px] font-bold tracking-widest text-muted uppercase">{group}</p>
              {items
                .filter((i) => i.group === group)
                .map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link key={item.href} href={item.href} className={cn('mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition', active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-ink')}>
                      <item.icon className={cn('size-4.5 shrink-0', active ? 'text-brand-600' : 'text-gray-400')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{initials(user.fullName)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-muted">{user.role.replace('_', '-').toLowerCase()}</p>
            </div>
            <button onClick={() => void logout()} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-point-red" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {navOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur">
          <button onClick={() => setNavOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-gray-100 lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>

          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} disabled={!canSwitchBranch && user.branches.length <= 1} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-100">
              <Building2 className="size-4 text-brand-600" />
              <span className="max-w-40 truncate">{activeBranch ? activeBranch.name : 'All branches'}</span>
              {(canSwitchBranch || user.branches.length > 1) && <ChevronDown className="size-3.5 text-muted" />}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <ul className="absolute z-20 mt-1 w-60 rounded-lg border border-line bg-white py-1 shadow-lg">
                  {canSwitchBranch && (
                    <li>
                      <button
                        onClick={() => {
                          setBranchId(null);
                          setMenuOpen(false);
                        }}
                        className={cn('w-full px-3 py-2 text-left text-sm hover:bg-brand-50', !branchId && 'font-semibold text-brand-700')}
                      >
                        All branches
                        <span className="block text-xs text-muted">Consolidated view</span>
                      </button>
                    </li>
                  )}
                  {user.branches.map((b) => (
                    <li key={b._id}>
                      <button
                        onClick={() => {
                          setBranchId(b._id);
                          setMenuOpen(false);
                        }}
                        className={cn('w-full px-3 py-2 text-left text-sm hover:bg-brand-50', branchId === b._id && 'font-semibold text-brand-700')}
                      >
                        {b.name}
                        <span className="block text-xs text-muted">{b.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <span className="ml-auto hidden text-xs text-muted sm:block">Dr. Bharath&apos;s Acu Heal</span>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
