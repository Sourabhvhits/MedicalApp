import crypto from 'node:crypto';
import { env } from '../config/env';

export function generateOtp(length = env.OTP_LENGTH): string {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, '0');
}

export const hashOtp = (code: string): string =>
  crypto.createHash('sha256').update(code).digest('hex');

export const otpExpiry = (): Date =>
  new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
