import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { MemoryCache } from './memory-cache';

@Injectable()
export class CacheService {
  private readonly memory = new MemoryCache();

  constructor(private readonly redis: RedisService) {}

  private get useRedis() {
    return Boolean(this.redis.client);
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis) {
      await this.redis.connect();
      const raw = await this.redis.client!.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }

    const raw = this.memory.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.useRedis) {
      await this.redis.connect();
      await this.redis.client!.set(key, serialized, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, serialized, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (this.useRedis) {
      await this.redis.connect();
      await this.redis.client!.del(key);
      return;
    }
    this.memory.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (this.useRedis) {
      await this.redis.connect();
      await this.redis.client!.del(...keys);
      return;
    }
    this.memory.delMany(keys);
  }
}
