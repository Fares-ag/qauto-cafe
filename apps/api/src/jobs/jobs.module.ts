import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ReportAggregationService } from './report-aggregation.service';

@Module({
  providers: [JobsService, ReportAggregationService],
  exports: [JobsService, ReportAggregationService],
})
export class JobsModule {}
