import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let client: Redis | null = null;

/** Returns a shared Redis client, or null when REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  client.on('error', (error) => logger.error({ err: error }, 'Redis error'));
  client.on('connect', () => logger.info('Redis connected'));
  return client;
}

/** Cache-aside helper. Falls through to the loader when Redis is unavailable. */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) return loader();

  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (error) {
    logger.warn({ err: error, key }, 'Cache read failed');
  }

  const value = await loader();
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.warn({ err: error, key }, 'Cache write failed');
  }
  return value;
}

export async function invalidate(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch (error) {
    logger.warn({ err: error, pattern }, 'Cache invalidation failed');
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
