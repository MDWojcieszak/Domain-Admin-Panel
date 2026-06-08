import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { AccessModule } from '../../ecosystem/access/access.module';
import { OptionalAuthGuard } from '../../common/guards';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Full-text search. SearchService is consumed both by the public read endpoint
 * and by VersioningModule (feed/clear at publish/unpublish/archive/rollback), so
 * it is exported. AccessModule provides the viewer-tier resolver used to gate
 * premium results.
 */
@Module({
  imports: [BlogCommonModule, AccessModule],
  controllers: [SearchController],
  providers: [SearchService, OptionalAuthGuard],
  exports: [SearchService],
})
export class SearchModule {}
