import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { HealthResponse } from '@qauto/shared-types';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    const redisUp = await this.redis.ping();
    const status = database === 'up' ? (redisUp ? 'ok' : 'degraded') : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis: redisUp ? 'up' : 'down',
      },
    };
  }
}
