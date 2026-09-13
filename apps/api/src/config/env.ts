import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default('uploads'),
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  STORAGE_INCLUDED_GB: z.coerce.number().default(30),
  STORAGE_EXCESS_RATE_INR: z.coerce.number().default(50),

  WHATSAPP_PROVIDER: z.enum(['console', 'meta']).default('console'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),

  BIOMETRIC_API_KEY: z.string().default('change-me'),
  JOBS_SECRET: z.string().default('change-me'),
  TZ: z.string().default('Asia/Kolkata'),

  SEED_ADMIN_EMAIL: z.string().default('admin@acuheal.local'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@12345'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const corsOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
