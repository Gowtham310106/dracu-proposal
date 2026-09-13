import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT';
  headers?: Record<string, string>;
}

export interface StorageDriver {
  name: string;
  presignUpload(key: string, mimeType: string, sizeBytes: number): Promise<PresignedUpload>;
  publicUrl(key: string): string;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/* ---------- Local disk (development) ---------- */

const uploadRoot = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);

export function signLocalKey(key: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(key).digest('hex');
}
export function verifyLocalSig(key: string, sig: string): boolean {
  const expected = Buffer.from(signLocalKey(key));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function safeLocalPath(key: string): string {
  const p = path.resolve(uploadRoot, key);
  if (!p.startsWith(uploadRoot)) throw new Error('Invalid storage key');
  return p;
}

export async function writeLocalFile(key: string, data: Buffer): Promise<void> {
  const p = safeLocalPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

class LocalDriver implements StorageDriver {
  name = 'local';
  async presignUpload(key: string): Promise<PresignedUpload> {
    const url = new URL('/api/v1/media/local-upload', env.API_PUBLIC_URL);
    url.searchParams.set('key', key);
    url.searchParams.set('sig', signLocalKey(key));
    return { uploadUrl: url.toString(), method: 'PUT' };
  }
  publicUrl(key: string): string {
    return `${env.API_PUBLIC_URL.replace(/\/$/, '')}/uploads/${key}`;
  }
  async exists(key: string): Promise<boolean> {
    try {
      await stat(safeLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string): Promise<void> {
    try {
      await unlink(safeLocalPath(key));
    } catch {
      /* already gone */
    }
  }
}

/* ---------- Cloudflare R2 (S3-compatible) ---------- */

class R2Driver implements StorageDriver {
  name = 'r2';
  private client: S3Client;
  private bucket: string;
  constructor() {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
      throw new Error('STORAGE_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
    }
    this.bucket = env.R2_BUCKET;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  async presignUpload(key: string, mimeType: string, sizeBytes: number): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType, ContentLength: sizeBytes });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 900 });
    return { uploadUrl, method: 'PUT', headers: { 'Content-Type': mimeType } };
  }
  publicUrl(key: string): string {
    const base = env.R2_PUBLIC_URL?.replace(/\/$/, '');
    if (!base) throw new Error('R2_PUBLIC_URL is required to build media URLs');
    return `${base}/${key}`;
  }
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | undefined;
export function storage(): StorageDriver {
  if (!driver) {
    driver = env.STORAGE_DRIVER === 'r2' ? new R2Driver() : new LocalDriver();
    logger.info({ driver: driver.name }, 'Storage driver ready');
  }
  return driver;
}

export { uploadRoot };
