import type { ProviderKind } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { decrypt, encrypt } from '../../lib/crypto';
import { env } from '../../config/env';
import {
  PROVIDER_FIELDS,
  envDefaults,
  isProviderConfigured,
  missingRequiredFields,
  resolveProviderConfig,
  type ProviderConfig,
  type ProviderField,
} from '../../lib/provider-credentials';

function mask(value: string): string {
  if (!value) return '';
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

export interface ProviderStatus {
  provider: ProviderKind;
  isActive: boolean;
  source: 'database' | 'env' | 'none';
  fields: (ProviderField & { value: string; hasValue: boolean })[];
}

export async function list(): Promise<ProviderStatus[]> {
  const providers: ProviderKind[] = ['SMS', 'EMAIL', 'PAYMENT_GATEWAY'];
  const results: ProviderStatus[] = [];

  for (const provider of providers) {
    const row = await prisma.providerCredential.findUnique({ where: { provider } });
    const db = row ? (JSON.parse(decrypt(row.encryptedConfig)) as ProviderConfig) : null;
    const hasEnvFallback = isProviderConfigured(provider, envDefaults(provider));

    const fields = PROVIDER_FIELDS[provider].map((field) => {
      const raw = db?.[field.key] ?? '';
      return { ...field, value: field.secret ? mask(raw) : raw, hasValue: Boolean(raw) };
    });

    results.push({
      provider,
      isActive: row?.isActive ?? false,
      source: row && row.isActive ? 'database' : hasEnvFallback ? 'env' : 'none',
      fields,
    });
  }

  return results;
}

/**
 * A key the caller didn't send at all keeps its previously saved value —
 * this is how the frontend leaves a masked secret field untouched (it never
 * re-submits the mask, it just omits the key), so saving a changed
 * non-secret field never wipes out an already-saved secret alongside it.
 */
export async function upsert(
  provider: ProviderKind,
  config: ProviderConfig,
  isActive: boolean,
  updatedById: string,
) {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) {
    throw ApiError.badRequest(
      'Set CREDENTIAL_ENCRYPTION_KEY in the backend .env before saving provider credentials here',
    );
  }

  const allowedKeys = new Set(PROVIDER_FIELDS[provider].map((f) => f.key));
  const incoming: ProviderConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (allowedKeys.has(key) && typeof value === 'string') incoming[key] = value;
  }

  const existing = await prisma.providerCredential.findUnique({ where: { provider } });
  const existingConfig = existing ? (JSON.parse(decrypt(existing.encryptedConfig)) as ProviderConfig) : {};
  const merged = { ...existingConfig, ...incoming };

  const encryptedConfig = encrypt(JSON.stringify(merged));
  return prisma.providerCredential.upsert({
    where: { provider },
    create: { provider, encryptedConfig, isActive, updatedById },
    update: { encryptedConfig, isActive, updatedById },
  });
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * EMAIL gets a real SMTP handshake (`nodemailer`'s `.verify()`) since that's
 * a genuine connection test with no provider SDK to pick. SMS and the
 * payment gateway have no adapter implemented yet (`lib/sms.ts`,
 * `lib/payment-gateway.ts` are seams, TASKS.md #2/#15) — faking a "connected"
 * result for those would be misleading, so this reports what's actually true:
 * whether the required fields are filled in.
 */
export async function testConnection(provider: ProviderKind): Promise<TestResult> {
  const config = await resolveProviderConfig(provider);
  const missing = missingRequiredFields(provider, config);
  if (missing.length > 0) {
    return { ok: false, message: `Missing: ${missing.map((f) => f.label).join(', ')}` };
  }

  if (provider === 'EMAIL') {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
      secure: Number(config.port) === 465,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    try {
      await transport.verify();
      return { ok: true, message: 'Connected to the SMTP server successfully.' };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }

  return {
    ok: true,
    message:
      provider === 'SMS'
        ? "Credentials saved. No SMS adapter is implemented yet (lib/sms.ts) — wire the chosen provider's API call to actually send."
        : "Credentials saved. No payment adapter is implemented yet (lib/payment-gateway.ts) — wire the chosen provider's SDK to go live.",
  };
}
