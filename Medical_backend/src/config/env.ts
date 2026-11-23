import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Medical Marketplace'),
  APP_URL: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(5),
  PUBLIC_UPLOAD_BASE_URL: z.string().default('http://localhost:5000/uploads'),

  REDIS_URL: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Medical Marketplace <no-reply@example.com>'),

  SMS_PROVIDER: z.string().optional().default(''),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().optional().default(''),

  PAYMENT_GATEWAY_PROVIDER: z.string().optional().default(''),
  PAYMENT_GATEWAY_KEY_ID: z.string().optional().default(''),
  PAYMENT_GATEWAY_KEY_SECRET: z.string().optional().default(''),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional().default(''),

  // Encrypts admin-saved provider credentials at rest (TASKS.md #16). Only
  // required once an admin actually saves a provider key via the settings
  // screen — env-var-only deployments never touch this.
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional().default(''),

  DEFAULT_SEARCH_RADIUS_KM: z.coerce.number().default(5),
  MAX_SEARCH_RADIUS_KM: z.coerce.number().default(50),
  ORDER_AUTO_EXPIRE_HOURS: z.coerce.number().default(24),
  ENABLE_CRON_JOBS: boolish(true),

  SEED_ADMIN_EMAIL: z.string().default('admin@medsaas.test'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@12345'),
  SEED_ADMIN_PHONE: z.string().default('9000000001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};

export type Env = typeof env;
