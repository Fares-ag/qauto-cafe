import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { getWsCorsOrigins } from '../config/security';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = this.config.get<string>('redisUrl');
    if (!url) return;

    try {
      const pub = new Redis(url, { maxRetriesPerRequest: null });
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      this.adapterConstructor = createAdapter(pub, sub);
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (error) {
      this.logger.warn(
        `Redis adapter unavailable: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOrigin = getWsCorsOrigins(this.config);
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigin,
        credentials: true,
      },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
