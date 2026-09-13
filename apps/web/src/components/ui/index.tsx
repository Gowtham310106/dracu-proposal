'use client';

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-500 disabled:bg-brand-300',
  secondary: 'bg-white text-ink border border-line hover:bg-gray-50 focus-visible:ring-brand-400',
  ghost: 'bg-transparent text-muted hover:bg-gray-100 hover:text-ink',
  danger: 'bg-point-red text-white hover:brightness-95 focus-visible:ring-red-400',
  success: 'bg-point-green text-white hover:brightness-95 focus-visible:ring-green-400',
};
const SIZES: Record<Size, string> = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-9.5 px-4 text-sm gap-2', lg: 'h-11 px-5 text-sm gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-70', VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------- Inputs ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('inp', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('inp', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('inp appearance-none bg-[right_0.5rem_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundSize: '1rem' }} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, required, error, help, children, className }: { label?: string; required?: boolean; error?: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="ml-0.5 text-point-red">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-point-red">{error}</p> : help ? <p className="mt-1 text-xs text-muted">{help}</p> : null}
    </div>
  );
}

/* ---------- Badge ---------- */

const TONES: Record<string, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  brand: 'bg-brand-50 text-brand-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-blue-50 text-blue-700',
  stone: 'bg-stone-100 text-stone-700',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: keyof typeof TONES; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

/** Consistent colour coding for every status string in the app. */
export function statusTone(status?: string): keyof typeof TONES {
  switch (status) {
    case 'Completed':
    case 'Paid':
    case 'Converted':
    case 'Present':
    case 'Active':
    case 'Sent':
    case 'Improved':
      return 'green';
    case 'Cancelled':
    case 'No-show':
    case 'Lost':
    case 'Unpaid':
    case 'Absent':
    case 'Failed':
    case 'Discontinued':
    case 'Worse':
      return 'red';
    case 'Partial':
    case 'Follow-up':
    case 'Half-day':
    case 'Paused':
    case 'Queued':
      return 'amber';
    case 'Checked-in':
    case 'In-treatment':
    case 'Attended':
      return 'blue';
    case 'Booked':
    case 'New':
      return 'brand';
    default:
      return 'neutral';
  }
}

/* ---------- Card & stats ---------- */

export function Card({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {typeof title === 'string' ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : title}
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, tone = 'brand', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'brand' | 'green' | 'red' | 'amber' | 'stone'; icon?: ReactNode }) {
  const bar = { brand: 'bg-brand-600', green: 'bg-point-green', red: 'bg-point-red', amber: 'bg-point-yellow', stone: 'bg-point-stone' }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {icon && <span className="shrink-0 text-brand-400">{icon}</span>}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-gray-100" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  /** hide on small screens */
  hideOnMobile?: boolean;
}

export function DataTable<T extends { _id: string }>({ columns, rows, loading, empty = 'Nothing here yet', onRowClick, page, pages, total, onPage }: { columns: Column<T>[]; rows: T[]; loading?: boolean; empty?: ReactNode; onRowClick?: (row: T) => void; page?: number; pages?: number; total?: number; onPage?: (p: number) => void }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-3 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-3', c.hideOnMobile && 'hidden md:table-cell')}>
                      <span className="block h-3.5 w-full max-w-32 animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} onClick={() => onRowClick?.(row)} className={cn('border-b border-line/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-50/40')}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2.5 align-middle', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages !== undefined && pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-xs text-muted">
          <span>
            Page {page} of {pages}
            {total !== undefined && ` · ${total} records`}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={(page ?? 1) <= 1} onClick={() => onPage?.((page ?? 1) - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={(page ?? 1) >= pages} onClick={() => onPage?.((page ?? 1) + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Tabs ---------- */

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition', active === t.id ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Chips input (points used, tags) ---------- */

export function ChipsInput({ value, onChange, placeholder, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="inp flex flex-wrap items-center gap-1.5 py-1.5">
      {value.map((chip) => (
        <span key={chip} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
          {chip}
          <button type="button" onClick={() => onChange(value.filter((c) => c !== chip))} aria-label={`Remove ${chip}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
      />
    </div>
  );
}

/* ---------- Multi-select (checkbox pills) ---------- */

export function MultiSelect({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" onClick={() => toggle(o.value)} className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Async search picker ---------- */

export interface PickerOption {
  _id: string;
  label: string;
  sub?: string;
}

export function SearchPicker({ value, valueLabel, onChange, search, placeholder = 'Search…', disabled }: { value?: string; valueLabel?: string; onChange: (id: string | undefined, option?: PickerOption) => void; search: (q: string) => Promise<PickerOption[]>; placeholder?: string; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PickerOption[]>([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setOpts([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      search(q.trim())
        .then(setOpts)
        .catch(() => setOpts([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, search]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (value && valueLabel && !open) {
    return (
      <div className="inp flex items-center justify-between gap-2">
        <span className="truncate text-sm">{valueLabel}</span>
        {!disabled && (
          <button type="button" onClick={() => onChange(undefined)} className="text-muted hover:text-point-red" aria-label="Clear selection">
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
        <input disabled={disabled} className="inp pl-8" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} />
      </div>
      {open && q.trim().length >= 2 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {busy && <li className="px-3 py-2 text-xs text-muted">Searching…</li>}
          {!busy && opts.length === 0 && <li className="px-3 py-2 text-xs text-muted">No matches</li>}
          {opts.map((o) => (
            <li key={o._id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-brand-50"
                onClick={() => {
                  onChange(o._id, o);
                  setOpen(false);
                  setQ('');
                }}
              >
                <span className="block text-sm font-medium">{o.label}</span>
                {o.sub && <span className="block text-xs text-muted">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Misc ---------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-point-red">{children}</p>;
}

/** Session meter: "Session 5 / 10" with a progress bar. */
export function SessionMeter({ completed, total, className }: { completed: number; total: number; className?: string }) {
  const pct = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <div className={cn('min-w-28', className)}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>
          Session {completed} / {total}
        </span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-point-green' : 'bg-brand-600')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        {summary}
        <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
