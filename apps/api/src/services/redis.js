import Redis from 'ioredis';
import { CONFIG } from '../lib/config.js';

let redis = null;
let redisConnected = false;

export function initRedis() {
  const redisUrl = CONFIG.REDIS_URL;

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      connectTimeout: CONFIG.REDIS_CONNECT_TIMEOUT,
    });

    redis.on('connect', () => {
      redisConnected = true;
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      redisConnected = false;
      console.error('Redis error:', err.message);
    });

    redis.connect().catch((err) => {
      console.warn('Failed to connect to Redis (running without caching):', err.message);
    });
  } catch (err) {
    console.warn('Redis initialization failed (running without caching):', err.message);
  }

  return redis;
}

export function getRedis() {
  return redis;
}

export function isRedisConnected() {
  return redisConnected && redis !== null;
}

// Phone number lookup
export async function isNumberSold(phoneE164) {
  if (!isRedisConnected()) return false;
  try {
    const key = `sold:${phoneE164}`;
    const cached = await redis.get(key);
    return cached === 'yes';
  } catch {
    return false;
  }
}

export async function markNumberSold(phoneE164, sold = true) {
  if (!isRedisConnected()) return;
  try {
    const key = `sold:${phoneE164}`;
    const value = sold ? 'yes' : 'no';
    await redis.set(key, value, 'EX', CONFIG.NUMBER_SOLD_TTL); // TTL per config
  } catch (err) {
    console.warn('Redis markNumberSold failed:', err.message);
  }
}

// Session management
export async function setSession(userId, token, ttlSeconds = CONFIG.SESSION_TTL) {
  if (!isRedisConnected()) return;
  try {
    const key = `session:${userId}`;
    await redis.set(key, token, 'EX', ttlSeconds);
  } catch (err) {
    console.warn('Redis setSession failed:', err.message);
  }
}

export async function getSession(userId) {
  if (!isRedisConnected()) return null;
  try {
    const key = `session:${userId}`;
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function deleteSession(userId) {
  if (!isRedisConnected()) return;
  try {
    const key = `session:${userId}`;
    await redis.del(key);
  } catch (err) {
    console.warn('Redis deleteSession failed:', err.message);
  }
}

// Callback queue management
export async function addCallbackToQueue(callbackId, timestamp) {
  if (!isRedisConnected()) return;
  try {
    await redis.zadd('cb:queue', timestamp, callbackId);
  } catch (err) {
    console.warn('Redis addCallbackToQueue failed:', err.message);
  }
}

export async function getDueCallbacks(currentTimestamp) {
  if (!isRedisConnected()) return [];
  try {
    return await redis.zrangebyscore('cb:queue', 0, currentTimestamp);
  } catch {
    return [];
  }
}

export async function removeCallbackFromQueue(callbackId) {
  if (!isRedisConnected()) return;
  try {
    await redis.zrem('cb:queue', callbackId);
  } catch (err) {
    console.warn('Redis removeCallbackFromQueue failed:', err.message);
  }
}

export default { initRedis, getRedis };
