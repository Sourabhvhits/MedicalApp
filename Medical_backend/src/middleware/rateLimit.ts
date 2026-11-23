import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';
import { getSecuritySettings } from '../lib/security-settings';

const skip = async (req: Request) => {
  if (env.isTest) return true;
  const { ipAllowList } = await getSecuritySettings();
  return ipAllowList.length > 0 && ipAllowList.includes(req.ip ?? '');
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: async () => (await getSecuritySettings()).globalMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

/** Login / register / password reset — tight limit to slow credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: async () => (await getSecuritySettings()).authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many authentication attempts, please try again later', code: 'RATE_LIMITED' },
});

/** OTP requests are the most abusable endpoint (they cost money to send). */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: async () => (await getSecuritySettings()).otpMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many OTP requests, please wait before retrying', code: 'RATE_LIMITED' },
});
