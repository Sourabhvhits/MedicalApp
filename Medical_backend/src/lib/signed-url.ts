import crypto from 'node:crypto';
import { env } from '../config/env';

const DEFAULT_TTL_SECONDS = 5 * 60;

function sign(relativePath: string, expires: number): string {
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${relativePath}:${expires}`)
    .digest('hex');
}

/** Turns `folder/filename.ext` into a time-limited URL — the query string is the only credential. */
export function signFilePath(relativePath: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expires = Date.now() + ttlSeconds * 1000;
  const base = env.PUBLIC_UPLOAD_BASE_URL.replace(/\/$/, '');
  return `${base}/${relativePath}?exp=${expires}&sig=${sign(relativePath, expires)}`;
}

/**
 * Re-signs a URL/path already stored on a record (prescription, KYC
 * document, …) so a value persisted before this feature existed still
 * works — only the relative `folder/filename` portion matters, whatever
 * host/query it currently carries is discarded.
 */
export function toSignedUrl(stored: string | null | undefined, ttlSeconds?: number): string | null {
  if (!stored) return null;
  const base = env.PUBLIC_UPLOAD_BASE_URL.replace(/\/$/, '');
  const relativePath = stored.startsWith(base) ? stored.slice(base.length + 1) : stored.replace(/^\/?uploads\//, '');
  return signFilePath(relativePath.split('?')[0], ttlSeconds);
}

/** Constant-time signature check used by the file-serving route. */
export function verifyFileSignature(relativePath: string, expiresParam: unknown, sigParam: unknown): boolean {
  if (typeof expiresParam !== 'string' || typeof sigParam !== 'string') return false;
  const expires = Number(expiresParam);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  const expected = Buffer.from(sign(relativePath, expires));
  const actual = Buffer.from(sigParam);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
