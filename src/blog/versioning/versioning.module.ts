import { Module } from '@nestjs/common';

import { SearchModule } from '../search/search.module';
import { VersionController } from './version.controller';
import { VersioningService } from './versioning.service';

/**
 * Owns the draft/published lifecycle (publish, schedule, archive/restore,
 * rollback, prune) and the lazy-clone edit guard consumed by the post/section
 * modules. The cron that publishes due SCHEDULED posts lives here too.
 */
@Module({
  imports: [SearchModule],
  controllers: [VersionController],
  providers: [VersioningService],
  exports: [VersioningService],
})
export class VersioningModule {}
