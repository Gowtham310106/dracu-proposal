import { Router, raw } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { listQuery, mediaConfirmInput, mediaPresignInput, MEDIA_LIMITS, type PresignResult, type StorageUsage } from '@acuheal/types';
import { Media } from '../../models/Media.js';
import { Patient } from '../../models/Patient.js';
import { Branch } from '../../models/Branch.js';
import { env } from '../../config/env.js';
import { requirePermission } from '../../middleware/auth.js';
import { branchFilter } from '../../middleware/branchScope.js';
import { validate, body, query } from '../../middleware/validate.js';
import { badRequest, notFound, unauthorized } from '../../middleware/error.js';
import { ok, created, paginate } from '../../utils/http.js';
import { audit } from '../../utils/audit.js';
import { isoToDate } from '../../utils/dates.js';
import { liftAll } from '../../utils/populate.js';
import { storage, verifyLocalSig, writeLocalFile } from '../../integrations/storage/index.js';

export const mediaRouter = Router();
/** Public router for the local-disk driver's signed PUT uploads (mounted before auth). */
export const localUploadRouter = Router();

const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

localUploadRouter.put('/local-upload', raw({ type: () => true, limit: `${Math.ceil(MEDIA_LIMITS.videoMaxBytes / 1024 / 1024) + 1}mb` }), async (req, res) => {
  const key = String(req.query.key ?? '');
  const sig = String(req.query.sig ?? '');
  if (!key || !sig || !verifyLocalSig(key, sig)) throw unauthorized('Invalid upload signature');
  const media = await Media.findOne({ storageKey: key }).select('sizeBytes').lean();
  if (!media) throw notFound('Upload not registered');
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw badRequest('Empty body');
  await writeLocalFile(key, buf);
  await Media.updateOne({ _id: media._id }, { $set: { sizeBytes: buf.length } });
  ok(res, { stored: true, bytes: buf.length });
});

mediaRouter.post('/presign', requirePermission('media:write'), validate(mediaPresignInput), async (req, res) => {
  const input = body<typeof mediaPresignInput>(req);
  const patient = await Patient.findById(input.patientId).select('branchId').lean();
  if (!patient) throw notFound('Patient not found');
  const ext = EXT[input.mimeType] ?? 'bin';
  const storageKey = `patients/${String(patient._id)}/${randomUUID()}.${ext}`;
  const drv = storage();
  const presigned = await drv.presignUpload(storageKey, input.mimeType, input.sizeBytes);
  const media = await Media.create({
    patientId: patient._id,
    branchId: patient.branchId,
    kind: input.kind,
    category: input.category,
    storageKey,
    url: drv.publicUrl(storageKey),
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    uploadedBy: req.user!.id,
    status: 'Pending',
  });
  const result: PresignResult = { uploadId: String(media._id), uploadUrl: presigned.uploadUrl, method: presigned.method, headers: presigned.headers, storageKey };
  created(res, result);
});

mediaRouter.post('/confirm', requirePermission('media:write'), validate(mediaConfirmInput), async (req, res) => {
  const input = body<typeof mediaConfirmInput>(req);
  const media = await Media.findById(input.uploadId);
  if (!media) throw notFound('Upload not found');
  if (!(await storage().exists(media.storageKey))) throw badRequest('File was not uploaded yet');
  media.status = 'Ready';
  if (input.title !== undefined) media.title = input.title;
  if (input.notes !== undefined) media.notes = input.notes;
  if (input.sessionLogId) media.sessionLogId = input.sessionLogId as never;
  if (input.capturedAt) media.capturedAt = isoToDate(input.capturedAt);
  if (input.durationSec !== undefined) media.durationSec = input.durationSec;
  await media.save();
  if (media.category === 'Profile' && media.kind === 'Photo') {
    await Patient.updateOne({ _id: media.patientId }, { $set: { photoUrl: media.url } });
  }
  audit({ userId: req.user!.id, action: 'create', entity: 'Media', entityId: String(media._id), branchId: String(media.branchId), summary: `${media.kind} uploaded (${Math.round(media.sizeBytes / 1024)} KB)` });
  ok(res, media.toObject());
});

const mediaListQuery = listQuery.extend({ patientId: z.string().optional(), kind: z.string().optional(), category: z.string().optional() });
mediaRouter.get('/', requirePermission('media:read'), validate(mediaListQuery, 'query'), async (req, res) => {
  const q = query<typeof mediaListQuery>(req);
  const filter: Record<string, unknown> = { ...branchFilter(req), status: 'Ready' };
  if (q.patientId) filter.patientId = q.patientId;
  if (q.kind) filter.kind = q.kind;
  if (q.category) filter.category = q.category;
  const { items, meta } = await paginate(Media, filter, { page: q.page, limit: q.limit, sort: q.sort ?? '-createdAt', populate: [{ path: 'patientId', select: 'pid fullName' }, { path: 'uploadedBy', select: 'fullName' }] });
  ok(res, liftAll(items as Record<string, unknown>[], { patientId: 'patient', uploadedBy: 'uploader' }), meta);
});

mediaRouter.get('/usage', requirePermission('media:read'), async (_req, res) => {
  const [agg, byBranch] = await Promise.all([
    Media.aggregate<{ bytes: number; videos: number; photos: number }>([
      { $match: { status: 'Ready' } },
      { $group: { _id: null, bytes: { $sum: '$sizeBytes' }, videos: { $sum: { $cond: [{ $eq: ['$kind', 'Video'] }, 1, 0] } }, photos: { $sum: { $cond: [{ $eq: ['$kind', 'Photo'] }, 1, 0] } } } },
    ]),
    Media.aggregate<{ _id: unknown; bytes: number; count: number }>([{ $match: { status: 'Ready' } }, { $group: { _id: '$branchId', bytes: { $sum: '$sizeBytes' }, count: { $sum: 1 } } }]),
  ]);
  const branches = await Branch.find({ _id: { $in: byBranch.map((b) => b._id) } }).select('name').lean();
  const names = new Map(branches.map((b) => [String(b._id), b.name]));
  const usedBytes = agg[0]?.bytes ?? 0;
  const includedBytes = env.STORAGE_INCLUDED_GB * 1024 ** 3;
  const excessBytes = Math.max(0, usedBytes - includedBytes);
  const excessGb = Math.ceil(excessBytes / 1024 ** 3);
  const usage: StorageUsage = {
    usedBytes,
    includedBytes,
    excessBytes,
    excessGb,
    ratePerGb: env.STORAGE_EXCESS_RATE_INR,
    estimatedExtraFee: excessGb * env.STORAGE_EXCESS_RATE_INR,
    videoCount: agg[0]?.videos ?? 0,
    photoCount: agg[0]?.photos ?? 0,
    byBranch: byBranch.map((b) => ({ branchId: String(b._id), branchName: names.get(String(b._id)) ?? '—', bytes: b.bytes, count: b.count })),
  };
  ok(res, usage);
});

mediaRouter.delete('/:id', requirePermission('media:write'), async (req, res) => {
  const media = await Media.findById(req.params.id).lean();
  if (!media) throw notFound('Media not found');
  await storage().delete(media.storageKey);
  await Media.deleteOne({ _id: media._id });
  audit({ userId: req.user!.id, action: 'delete', entity: 'Media', entityId: String(media._id), branchId: String(media.branchId), summary: `${media.kind} deleted`, before: { storageKey: media.storageKey, title: media.title } });
  ok(res, { deleted: true });
});
