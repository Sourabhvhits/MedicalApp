"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.cached = cached;
exports.invalidate = invalidate;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const logger_1 = require("./logger");
let client = null;
/** Returns a shared Redis client, or null when REDIS_URL is not configured. */
function getRedis() {
    if (!env_1.env.REDIS_URL)
        return null;
    if (client)
        return client;
    client = new ioredis_1.default(env_1.env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
    client.on('error', (error) => logger_1.logger.error({ err: error }, 'Redis error'));
    client.on('connect', () => logger_1.logger.info('Redis connected'));
    return client;
}
/** Cache-aside helper. Falls through to the loader when Redis is unavailable. */
async function cached(key, ttlSeconds, loader) {
    const redis = getRedis();
    if (!redis)
        return loader();
    try {
        const hit = await redis.get(key);
        if (hit)
            return JSON.parse(hit);
    }
    catch (error) {
        logger_1.logger.warn({ err: error, key }, 'Cache read failed');
    }
    const value = await loader();
    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
    }
    catch (error) {
        logger_1.logger.warn({ err: error, key }, 'Cache write failed');
    }
    return value;
}
async function invalidate(pattern) {
    const redis = getRedis();
    if (!redis)
        return;
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0)
            await redis.del(...keys);
    }
    catch (error) {
        logger_1.logger.warn({ err: error, pattern }, 'Cache invalidation failed');
    }
}
async function closeRedis() {
    if (client) {
        await client.quit();
        client = null;
    }
}
//# sourceMappingURL=redis.js.map