import { prisma } from '../database/prisma';

export interface SecuritySettings {
  globalMax: number;
  authMax: number;
  otpMax: number;
  ipAllowList: string[];
}

const DEFAULTS: SecuritySettings = {
  globalMax: 1000,
  authMax: 20,
  otpMax: 5,
  ipAllowList: [],
};

let cache: { value: SecuritySettings; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

/**
 * Admin-configurable rate-limit thresholds and an IP allow-list (TASKS.md
 * #18), backed by the existing `Setting` table (`group: 'security'`) rather
 * than a new one. Cached briefly since `middleware/rateLimit.ts` reads this
 * on every request — `invalidate()` is called from `updateSettings()` so a
 * saved change takes effect immediately rather than waiting out the cache.
 *
 * Only the request *count* per window is live-configurable. The window
 * length itself (15 min / 10 min) is fixed at server start — `express-rate-limit`
 * v7 supports a dynamic `limit`/`skip` function but not swapping a limiter's
 * window without recreating it, so exposing that as "live" would be
 * decorative; scoped down deliberately rather than faking it.
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await prisma.setting.findMany({ where: { group: 'security' } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const num = (key: string, fallback: number) => {
    const raw = map.get(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const value: SecuritySettings = {
    globalMax: num('security.rate_limit.global_max', DEFAULTS.globalMax),
    authMax: num('security.rate_limit.auth_max', DEFAULTS.authMax),
    otpMax: num('security.rate_limit.otp_max', DEFAULTS.otpMax),
    ipAllowList: (map.get('security.ip_allow_list') ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  };
  cache = { value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function invalidateSecuritySettingsCache(): void {
  cache = null;
}
