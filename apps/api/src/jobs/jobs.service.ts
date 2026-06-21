import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  AggregationAction,
  AggregationOptions,
  ReportAggregationService,
} from './report-aggregation.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aggregation: ReportAggregationService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    void this.scheduleAuditRetention();
  }

  private async scheduleAuditRetention() {
    const retentionDays = this.config.get<number>('auditRetentionDays', 365);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Purged ${result.count} audit log entries older than ${retentionDays} days`);
      }
    } catch (error) {
      this.logger.warn(
        `Audit retention job failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async enqueueOrderAggregation(
    orderId: string,
    action: AggregationAction,
    options: AggregationOptions = {},
  ) {
    await this.aggregation.aggregateOrder(orderId, action, options);
  }

  scheduleOrderAggregation(
    orderId: string,
    action: AggregationAction,
    options: AggregationOptions = {},
  ) {
    void this.enqueueOrderAggregation(orderId, action, options).catch((error) => {
      this.logger.error(
        `Aggregation ${action} for order ${orderId} failed: ${error instanceof Error ? error.message : error}`,
      );
    });
  }
}
