import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [PoiController],
  providers: [PoiService],
  exports: [PoiService],
})
export class PoiModule {}
