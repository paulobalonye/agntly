import IORedis from 'ioredis';
import type { FastifyReply } from 'fastify';

const RATE_LIMIT_MAX = 100;
const WINDOW_SECONDS = 60;

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

try {
  redis = new (IORedis as any)(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redis.on('error', (err: Error) => {
    console.error('Redis rate-limit connection error:', err.message);
  });

  await redis.connect();
} catch {
  console.warn('Redis unavailable for API key rate limiting — allowing all requests');
  redis = null;
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}

async function checkRateLimit(apiKeyPrefix: string): Promise<RateLimitResult> {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const resetAt = (minuteBucket + 1) * 60;
  const redisKey = `ratelimit:${apiKeyPrefix}:${minuteBucket}`;

  if (!redis) {
    return { allowed: true, limit: RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX, resetAt };
  }

  try {
    const count = await redis.incr(redisKey);

    // Set expiry only on first increment to avoid resetting TTL
    if (count === 1) {
      await redis.expire(redisKey, WINDOW_SECONDS + 5);
    }

    const remaining = Math.max(0, RATE_LIMIT_MAX - count);
    return { allowed: count <= RATE_LIMIT_MAX, limit: RATE_LIMIT_MAX, remaining, resetAt };
  } catch {
    // Graceful degradation — if Redis fails, allow the request
    return { allowed: true, limit: RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX, resetAt };
  }
}

/**
 * Extracts a prefix from the API key for use as the rate limit bucket identifier.
 * Uses the first 12 characters to avoid storing the full key in Redis.
 */
function extractKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}

/**
 * Checks per-API-key rate limit and sets response headers.
 * Returns true if the request is allowed, false if rate limited (429 already sent).
 */
export async function enforceApiKeyRateLimit(
  apiKey: string,
  reply: FastifyReply,
): Promise<boolean> {
  const keyPrefix = extractKeyPrefix(apiKey);
  const result = await checkRateLimit(keyPrefix);

  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetAt);

  if (!result.allowed) {
    const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
    reply.header('retry-after', retryAfter);
    reply.status(429).send({
      success: false,
      data: null,
      error: 'Rate limit exceeded. Please retry after the window resets.',
    });
    return false;
  }

  return true;
}
