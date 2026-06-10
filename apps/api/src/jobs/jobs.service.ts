import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { ReportAggregationService } from './report-aggregation.service';

export const AGGREGATION_QUEUE = 'report-aggregation';

export interface AggregationJobData {
  orderId: string;
  action: 'order_paid' | 'order_voided';
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
  ) {}

  async onModuleInit() {
    const connected = await this.redis.connect();
    if (!connected) {
      this.logger.warn('BullMQ disabled — Redis not available');
      return;
    }

    const connection = {
      url: this.config.get<string>('redisUrl'),
      maxRetriesPerRequest: null,
    };

    this.queue = new Queue<AggregationJobData>(AGGREGATION_QUEUE, { connection });

    this.worker = new Worker<AggregationJobData>(
      AGGREGATION_QUEUE,
      async (job: Job<AggregationJobData>) => {
        await this.aggregation.aggregateOrder(job.data.orderId, job.data.action);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Aggregation job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('BullMQ aggregation worker started');
  }

  async enqueueOrderAggregation(orderId: string, action: AggregationJobData['action']) {
    if (!this.queue) {
      await this.aggregation.aggregateOrder(orderId, action);
      return;
    }

    await this.queue.add(
      action,
      { orderId, action },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
