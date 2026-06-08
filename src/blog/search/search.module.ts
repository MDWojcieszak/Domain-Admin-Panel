import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Full-text search. SearchService is consumed both by the public read endpoint
 * and by VersioningModule (feed/clear at publish/unpublish/archive/rollback), so
 * it is exported.
 */
@Module({
  imports: [BlogCommonModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
