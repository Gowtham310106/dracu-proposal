import { z } from 'zod';
import { MEDIA_CATEGORIES, MEDIA_KINDS } from '../enums.js';
import type { Timestamped } from '../api.js';
import { MEDIA_LIMITS } from '../fields/media.js';
import { optionalIsoDate, optionalObjectId, optionalText } from './common.js';

export const mediaPresignInput = z
  .object({
    patientId: z.string().min(1),
    kind: z.enum(MEDIA_KINDS),
    category: z.enum(MEDIA_CATEGORIES).default('Progress'),
    fileName: z.string().min(1).max(200),
    mimeType: z.string().min(1),
    sizeBytes: z.coerce.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const allowed: readonly string[] = v.kind === 'Video' ? MEDIA_LIMITS.videoMimes : [...MEDIA_LIMITS.photoMimes, ...MEDIA_LIMITS.documentMimes];
    if (!allowed.includes(v.mimeType)) ctx.addIssue({ code: 'custom', path: ['mimeType'], message: `Unsupported file type ${v.mimeType}` });
    const max = v.kind === 'Video' ? MEDIA_LIMITS.videoMaxBytes : MEDIA_LIMITS.photoMaxBytes;
    if (v.sizeBytes > max) ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `File exceeds ${Math.round(max / 1024 / 1024)} MB limit` });
  });
export type MediaPresignInput = z.infer<typeof mediaPresignInput>;

export const mediaConfirmInput = z.object({
  uploadId: z.string().min(1),
  title: optionalText,
  notes: optionalText,
  sessionLogId: optionalObjectId,
  capturedAt: optionalIsoDate,
  durationSec: z.coerce.number().min(0).optional(),
});
export type MediaConfirmInput = z.infer<typeof mediaConfirmInput>;

export interface MediaItem extends Timestamped {
  patientId: string;
  branchId: string;
  kind: (typeof MEDIA_KINDS)[number];
  category: (typeof MEDIA_CATEGORIES)[number];
  sessionLogId?: string;
  title?: string;
  notes?: string;
  storageKey: string;
  url: string;
  sizeBytes: number;
  durationSec?: number;
  mimeType: string;
  uploadedBy: string;
  capturedAt?: string;
  status: 'Pending' | 'Ready';
  patient?: { _id: string; pid: string; fullName: string };
}

export interface StorageUsage {
  usedBytes: number;
  includedBytes: number;
  excessBytes: number;
  excessGb: number;
  ratePerGb: number;
  estimatedExtraFee: number;
  videoCount: number;
  photoCount: number;
  byBranch: { branchId: string; branchName: string; bytes: number; count: number }[];
}

export interface PresignResult {
  uploadId: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  storageKey: string;
}
