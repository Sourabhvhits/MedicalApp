import type { ProviderKind } from '@prisma/client';
import { prisma } from '../database/prisma';
import { decrypt } from './crypto';
import { env } from '../config/env';

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  /** Fixed choices — the frontend renders a dropdown instead of a free-text input. */
  options?: { value: string; label: string }[];
}

export const SMS_PROVIDER_OPTIONS = [
  { value: 'msg91', label: 'MSG91' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'gupshup', label: 'Gupshup' },
];

export const PAYMENT_GATEWAY_PROVIDER_OPTIONS = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
];

export const PROVIDER_FIELDS: Record<ProviderKind, ProviderField[]> = {
  SMS: [
    { key: 'provider', label: 'Provider', options: SMS_PROVIDER_OPTIONS },
    { key: 'apiKey', label: 'API key', secret: true },
    { key: 'senderId', label: 'Sender ID' },
  ],
  EMAIL: [
    { key: 'host', label: 'SMTP host' },
    { key: 'port', label: 'SMTP port' },
    { key: 'user', label: 'SMTP username' },
    { key: 'pass', label: 'SMTP password', secret: true },
    { key: 'from', label: 'From address' },
  ],
  PAYMENT_GATEWAY: [
    { key: 'provider', label: 'Provider', options: PAYMENT_GATEWAY_PROVIDER_OPTIONS },
    { key: 'keyId', label: 'Key ID' },
    { key: 'keySecret', label: 'Key secret', secret: true },
    { key: 'webhookSecret', label: 'Webhook secret', secret: true },
  ],
};

export type ProviderConfig = Record<string, string>;

export function envDefaults(provider: ProviderKind): ProviderConfig {
  if (provider === 'SMS') {
    return { provider: env.SMS_PROVIDER, apiKey: env.SMS_API_KEY, senderId: env.SMS_SENDER_ID };
  }
  if (provider === 'EMAIL') {
    return {
      host: env.SMTP_HOST,
      port: String(env.SMTP_PORT),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.MAIL_FROM,
    };
  }
  return {
    provider: env.PAYMENT_GATEWAY_PROVIDER,
    keyId: env.PAYMENT_GATEWAY_KEY_ID,
    keySecret: env.PAYMENT_GATEWAY_KEY_SECRET,
    webhookSecret: env.PAYMENT_GATEWAY_WEBHOOK_SECRET,
  };
}

/** Decrypted DB override for a provider, or null if none is saved/active. */
export async function getActiveDbConfig(provider: ProviderKind): Promise<ProviderConfig | null> {
  const row = await prisma.providerCredential.findUnique({ where: { provider } });
  if (!row || !row.isActive) return null;
  return JSON.parse(decrypt(row.encryptedConfig)) as ProviderConfig;
}

/**
 * The config `lib/sms.ts`/`lib/mailer.ts`/`lib/payment-gateway.ts` actually
 * send with — an admin-saved DB value per field wins when set (TASKS.md
 * #16), otherwise the matching `.env` var, so an env-var-only deployment
 * keeps working exactly as before this feature existed.
 */
export async function resolveProviderConfig(provider: ProviderKind): Promise<ProviderConfig> {
  const db = await getActiveDbConfig(provider);
  const fallback = envDefaults(provider);
  if (!db) return fallback;
  const merged: ProviderConfig = { ...fallback };
  for (const field of PROVIDER_FIELDS[provider]) {
    if (db[field.key]) merged[field.key] = db[field.key];
  }
  return merged;
}

export const resolveSmsConfig = () => resolveProviderConfig('SMS');
export const resolveEmailConfig = () => resolveProviderConfig('EMAIL');
export const resolvePaymentConfig = () => resolveProviderConfig('PAYMENT_GATEWAY');

/** Fields that must be non-empty for a provider to be considered usable — optional per-provider extras excluded. */
const REQUIRED_FIELDS: Record<ProviderKind, string[]> = {
  SMS: ['provider', 'apiKey'],
  EMAIL: ['host'],
  PAYMENT_GATEWAY: ['provider', 'keyId', 'keySecret'],
};

export function isProviderConfigured(provider: ProviderKind, config: ProviderConfig): boolean {
  return REQUIRED_FIELDS[provider].every((key) => Boolean(config[key]));
}

export function missingRequiredFields(provider: ProviderKind, config: ProviderConfig): ProviderField[] {
  const required = new Set(REQUIRED_FIELDS[provider]);
  return PROVIDER_FIELDS[provider].filter((field) => required.has(field.key) && !config[field.key]);
}
