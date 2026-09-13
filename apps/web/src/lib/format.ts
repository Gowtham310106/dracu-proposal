import dayjs from 'dayjs';

export const inr = (n?: number | null): string => `₹${(n ?? 0).toLocaleString('en-IN')}`;
export const inrShort = (n?: number | null): string => {
  const v = n ?? 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v}`;
};

export const fmtDate = (d?: string | Date | null): string => (d ? dayjs(d).format('DD MMM YYYY') : '—');
export const fmtDateTime = (d?: string | Date | null): string => (d ? dayjs(d).format('DD MMM YYYY, h:mm A') : '—');
export const fmtTime = (hhmm?: string | null): string => {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h ?? 0;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
};
export const today = (): string => dayjs().format('YYYY-MM-DD');
export const daysAgo = (n: number): string => dayjs().subtract(n, 'day').format('YYYY-MM-DD');
export const startOfMonth = (): string => dayjs().startOf('month').format('YYYY-MM-DD');
export const relative = (d?: string | Date | null): string => {
  if (!d) return '—';
  const diff = dayjs().diff(dayjs(d), 'day');
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 30) return `${diff} days ago`;
  if (diff < -1 && diff > -30) return `in ${-diff} days`;
  return fmtDate(d);
};

export const mobileDisplay = (m?: string | null): string => (m ? `+91 ${m}` : '—');
export const bytes = (n = 0): string => {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
};

export const initials = (name?: string): string =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
