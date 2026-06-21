import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AggregationAction,
  AggregationOptions,
  ReportAggregationService,
} from './report-aggregation.service';

export const AGGREGATION_QUEUE = 'report-aggregation';

export interface AggregationJobData {
  orderId: string;
  action: AggregationAction;
  refundId?: string;
  lineIds?: string[];
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private queue: Queue<AggregationJobData> | null = null;
  private worker: Worker<AggregationJobData> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly aggregation: ReportAggregationService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    void this.scheduleAuditRetention();

    const bullmqEnabled = this.config.get<boolean>('bullmqEnabled', true);
    if (!bullmqEnabled) {
      this.logger.log(
        'BullMQ disabled — report aggregation runs in-process (set BULLMQ_ENABLED=true with a dedicated Redis for queues)',
      );
      return;
    }

    const connected = await this.redis.connect();
    if (!connected) {
      this.logger.warn('BullMQ disabled — Redis not available');
      return;
    }

    const workerEnabled = this.config.get<boolean>('workerEnabled', true);

    const connection = {
      url: this.config.get<string>('redisUrl'),
      maxRetriesPerRequest: null,
    };

    this.queue = new Queue<AggregationJobData>(AGGREGATION_QUEUE, { connection });

    if (!workerEnabled) {
      this.logger.log('BullMQ worker disabled — queue-only mode (WORKER_ENABLED=false)');
      return;
    }

    this.worker = new Worker<AggregationJobData>(
      AGGREGATION_QUEUE,
      async (job: Job<AggregationJobData>) => {
        const { orderId, action, refundId, lineIds } = job.data;
        const options: AggregationOptions = { refundId, lineIds };
        await this.aggregation.aggregateOrder(orderId, action, options);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Aggregation job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('BullMQ aggregation worker started');
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
    if (!this.queue) {
      await this.aggregation.aggregateOrder(orderId, action, options);
      return;
    }

    try {
      await this.queue.add(
        action,
        { orderId, action, refundId: options.refundId, lineIds: options.lineIds },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Queue add failed for ${action} on ${orderId}, running in-process: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await this.aggregation.aggregateOrder(orderId, action, options);
    }
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

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
