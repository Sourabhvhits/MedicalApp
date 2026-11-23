import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function deriveKey(): Buffer {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) {
    throw ApiError.internal(
      'CREDENTIAL_ENCRYPTION_KEY is not set — set it in .env before saving a provider credential',
    );
  }
  return scryptSync(env.CREDENTIAL_ENCRYPTION_KEY, 'medsaas-provider-credentials', 32);
}

/** Encrypts a plaintext string (JSON.stringify'd config) into `iv:authTag:ciphertext`, all base64. */
export function encrypt(plainText: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Reverses `encrypt`. Throws if the key changed or the payload was tampered with. */
export function decrypt(payload: string): string {
  const key = deriveKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw ApiError.internal('Malformed encrypted payload');

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
