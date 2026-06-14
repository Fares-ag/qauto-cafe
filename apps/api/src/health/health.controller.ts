import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { HealthResponse } from '@qauto/shared-types';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  async check(@Headers('x-health-token') healthToken?: string): Promise<HealthResponse> {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    const expectedToken = this.config.get<string>('healthCheckSecret', '');

    if (nodeEnv === 'production' && expectedToken) {
      if (healthToken !== expectedToken) {
        throw new UnauthorizedException('Health check token required');
      }
    }

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
