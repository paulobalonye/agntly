import IORedis from 'ioredis';

export class CacheService {
  private redis: any;

  constructor(redisUrl?: string) {
    this.redis = new (IORedis as any)(redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const val = await this.redis.incr(key);
    if (ttlSeconds && val === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return val;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
