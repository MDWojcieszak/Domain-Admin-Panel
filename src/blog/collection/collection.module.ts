import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

/**
 * POI collections (ranked "top places"). Reuses the shared public POI projection
 * from the POI module via a static import (PoiMapper/PUBLIC_POI_SELECT), so no
 * DI dependency on PoiModule is needed.
 */
@Module({
  imports: [BlogCommonModule],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
