import { Module } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronJobsService],
  exports: [CronJobsService],
})
export class CronJobsModule {}
