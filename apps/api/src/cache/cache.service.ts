import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis.client) return null;
    await this.redis.connect();
    const raw = await this.redis.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis.client) return;
    await this.redis.connect();
    await this.redis.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.redis.client) return;
    await this.redis.connect();
    await this.redis.client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (!this.redis.client || keys.length === 0) return;
    await this.redis.connect();
    await this.redis.client.del(...keys);
  }
}
