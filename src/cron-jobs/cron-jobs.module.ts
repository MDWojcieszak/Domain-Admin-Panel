import { Module } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ServerService } from '../server/server.service';

@Module({
  imports: [MultiVerseModule, ScheduleModule.forRoot()],
  providers: [CronJobsService, ServerService],
  exports: [CronJobsService],
})
export class CronJobsModule {}
