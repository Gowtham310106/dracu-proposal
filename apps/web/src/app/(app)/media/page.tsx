'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { MEDIA_CATEGORIES, MEDIA_KINDS } from '@acuheal/types';
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard } from '@/components/ui';
import { mediaService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { bytes, fmtDate, inr } from '@/lib/format';
import { SectionLoader } from '@/components/BrandLoader';

export default function MediaPage() {
  const { branchId, can } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data: usage } = useQuery({ queryKey: ['media-usage'], queryFn: mediaService.usage });
  const { data, isLoading } = useQuery({ queryKey: ['media', kind, category, page, branchId], queryFn: () => mediaService.list({ kind, category, page, limit: 24 }) });

  const remove = useMutation({
    mutationFn: (id: string) => mediaService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['media-usage'] });
    },
  });

  const pct = usage ? Math.min(100, Math.round((usage.usedBytes / usage.includedBytes) * 100)) : 0;

  return (
    <>
      <PageHeader title="Media archive" subtitle="Treatment progress videos and patient photos" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Storage used" value={bytes(usage?.usedBytes)} sub={`of ${bytes(usage?.includedBytes)} included`} tone={pct > 90 ? 'red' : 'brand'} />
        <StatCard label="Videos" value={usage?.videoCount ?? 0} tone="green" />
        <StatCard label="Photos" value={usage?.photoCount ?? 0} tone="stone" />
        <StatCard label="Extra storage fee" value={inr(usage?.estimatedExtraFee)} sub={usage?.excessGb ? `${usage.excessGb} GB over at ${inr(usage.ratePerGb)}/GB` : 'Within the included plan'} tone={usage?.excessGb ? 'amber' : 'green'} />
      </div>

      <Card className="mt-4" title="Storage meter">
        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${pct > 90 ? 'bg-point-red' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>0</span>
          <span className="font-semibold">
            {pct}% of {bytes(usage?.includedBytes)} used
          </span>
          <span>{bytes(usage?.includedBytes)}</span>
        </div>
        {(usage?.byBranch.length ?? 0) > 1 && (
          <ul className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-3">
            {usage?.byBranch.map((b) => (
              <li key={b.branchId} className="rounded-lg border border-line px-3 py-2">
                <p className="text-sm font-semibold">{b.branchName}</p>
                <p className="text-xs text-muted">
                  {bytes(b.bytes)} · {b.count} files
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Storage is billed on actual usage only. No extra charge while total media stays within the included allowance.</p>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <Select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="w-36">
          <option value="">All media</option>
          {MEDIA_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-40">
          <option value="">All categories</option>
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <SectionLoader />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Card className="mt-4">
          <EmptyState title="No media uploaded yet" hint="Upload progress videos or photos from a patient's record." />
        </Card>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((m) => (
              <li key={m._id} className="card overflow-hidden">
                {m.kind === 'Video' ? <video src={m.url} controls preload="metadata" className="aspect-video w-full bg-black object-contain" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.title ?? 'Patient media'} className="aspect-video w-full object-cover" />}
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{m.title || `${m.kind} · ${m.category}`}</p>
                  <Link href={`/patients/${m.patientId}`} className="text-xs text-brand-700 hover:underline">
                    {(m as { patient?: { fullName: string; pid: string } }).patient?.fullName} ({(m as { patient?: { pid: string } }).patient?.pid})
                  </Link>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="flex gap-1">
                      <Badge tone="stone">{m.category}</Badge>
                      <Badge tone="neutral">{bytes(m.sizeBytes)}</Badge>
                    </span>
                    {can('media:write') && (
                      <button onClick={() => confirm('Delete this file permanently?') && remove.mutate(m._id)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-point-red" aria-label="Delete media">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{fmtDate(m.capturedAt ?? m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
          {(data?.meta?.pages ?? 1) > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted">
                Page {data?.meta?.page} of {data?.meta?.pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= (data?.meta?.pages ?? 1)} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
