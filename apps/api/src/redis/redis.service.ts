import { Global, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('redisUrl');
    try {
      this.client = new Redis(url!, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
    } catch (error) {
      this.logger.warn('Redis client init failed — queues and pub/sub disabled');
      this.client = null;
    }
  }

  async connect(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.warn(`Redis unavailable: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }
}
