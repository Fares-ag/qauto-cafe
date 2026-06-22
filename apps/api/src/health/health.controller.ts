import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { HealthResponse } from '@qauto/shared-types';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
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
    let dbLatencyMs: number | undefined;

    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
      dbLatencyMs = Date.now() - started;
    } catch {
      database = 'down';
      dbLatencyMs = Date.now() - started;
    }

    return {
      status: database === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis: 'skipped',
      },
      dbLatencyMs,
    };
  }
}
