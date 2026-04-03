import Redis from 'ioredis';

let redis = null;

export function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  redis.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err.message);
  });

  return redis;
}

export function getRedis() {
  if (!redis) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redis;
}

// Phone number lookup
export async function isNumberSold(phoneE164) {
  const key = `sold:${phoneE164}`;
  const cached = await redis.get(key);
  return cached === 'yes';
}

export async function markNumberSold(phoneE164, sold = true) {
  const key = `sold:${phoneE164}`;
  const value = sold ? 'yes' : 'no';
  await redis.set(key, value, 'EX', 86400); // 24h TTL
}

// Session management
export async function setSession(userId, token, ttlSeconds = 28800) {
  const key = `session:${userId}`;
  await redis.set(key, token, 'EX', ttlSeconds);
}

export async function getSession(userId) {
  const key = `session:${userId}`;
  return await redis.get(key);
}

export async function deleteSession(userId) {
  const key = `session:${userId}`;
  await redis.del(key);
}

// Callback queue management
export async function addCallbackToQueue(callbackId, timestamp) {
  await redis.zadd('cb:queue', timestamp, callbackId);
}

export async function getDueCallbacks(currentTimestamp) {
  return await redis.zrangebyscore('cb:queue', 0, currentTimestamp);
}

export async function removeCallbackFromQueue(callbackId) {
  await redis.zrem('cb:queue', callbackId);
}

export default { initRedis, getRedis };
